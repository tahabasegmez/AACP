import { AppError } from '@core/error';
import { Logger } from '@core/logger';
import { HttpClient, KeyValueStorage } from '@core/ports';

const DEVICE_ID_KEY = 'aacp.device.id';
const TOKEN_KEY = 'aacp.auth.token';
const REFRESH_TOKEN_KEY = 'aacp.auth.refresh';

interface AuthSessionDto {
  readonly token?: string;
  /** Erişim jetonu kısa ömürlüdür; yenileme bununla yapılır. */
  readonly refreshToken?: string;
  readonly userId?: string;
  readonly expiresInSec?: number;
}

/**
 * ApiClient — AACP backend'iyle konuşan tek nokta.
 *
 * Sorumlulukları:
 *  - Cihaz kimliğini (anonim UUID) üretip kalıcı saklamak,
 *  - Oturum jetonunu almak/yenilemek ve isteklere eklemek,
 *  - 401 alındığında bir kez yeniden kimlik doğrulayıp isteği tekrarlamak.
 *
 * Backend adresi (`baseUrl`) yapılandırılmamışsa istemci "kapalı" durumdadır ve
 * tüm çağrılar sessizce yok sayılır; böylece sunucusuz çalışma bozulmaz.
 */
export class ApiClient {
  private token?: string;
  private refreshToken?: string;
  /** Aynı anda birden çok isteğin kimlik doğrulamaya girmesini önler. */
  private pendingAuth?: Promise<string | undefined>;
  /**
   * Sunucuda anonim oturum kapalıysa true olur ve bir daha denenmez.
   *
   * Bu bir YAPILANDIRMA durumudur, geçici bir hata değil: her istekte tekrar
   * denemek boşuna ağ trafiği ve log gürültüsü yaratır. Kullanıcı hesapla
   * giriş yaptığında normal akış zaten devreye girer.
   */
  private anonymousDisabled = false;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: KeyValueStorage,
    private readonly logger: Logger,
    private readonly baseUrl?: string,
  ) {
    this.token = storage.getString(TOKEN_KEY) ?? undefined;
    this.refreshToken = storage.getString(REFRESH_TOKEN_KEY) ?? undefined;
  }

  get enabled(): boolean {
    return Boolean(this.baseUrl);
  }

  /** Kimlik gerektirmeyen GET (ör. katalog). */
  async get<T>(path: string): Promise<T | undefined> {
    if (!this.baseUrl) {
      return undefined;
    }
    const text = await this.http.getText(this.url(path), {
      headers: await this.authHeaders(),
    });
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw AppError.parse(`Yanıt ayrıştırılamadı — ${path}`, error);
    }
  }

  /** Kimlikli POST; 401 durumunda oturumu yenileyip bir kez daha dener. */
  async post<T>(path: string, body: unknown): Promise<T | undefined> {
    if (!this.baseUrl) {
      return undefined;
    }
    try {
      return await this.http.postJson<T>(this.url(path), body, {
        headers: await this.authHeaders(),
      });
    } catch (error) {
      if (error instanceof AppError && error.code === 'UNAUTHORIZED') {
        // YALNIZCA erişim jetonu düşürülür. Yenileme jetonu da silinseydi
        // `ensureSession` tazeleyemez ve doğrudan ANONİM oturuma düşerdi:
        // kullanıcı, jetonunun süresi dolduğu anda sessizce misafire dönerdi.
        this.clearAccessToken();
        const refreshed = await this.ensureSession();
        if (refreshed) {
          return this.http.postJson<T>(this.url(path), body, {
            headers: { Authorization: `Bearer ${refreshed}` },
          });
        }
      }
      throw error;
    }
  }

  /**
   * Oturum jetonunu dışarıdan ayarlar (giriş/kayıt sonrası).
   * `undefined` verilirse oturum kapatılır ve bir sonraki istekte yeniden
   * anonim oturum açılır.
   */
  setToken(token?: string, refreshToken?: string): void {
    if (token) {
      this.token = token;
      this.storage.set(TOKEN_KEY, token);
      if (refreshToken) {
        this.refreshToken = refreshToken;
        this.storage.set(REFRESH_TOKEN_KEY, refreshToken);
      }
    } else {
      this.clearToken();
    }
  }

  /** Cihazın kalıcı anonim kimliği (hesap işlemlerinde de kullanılır). */
  getDeviceId(): string {
    return this.deviceId();
  }

  /** Oturum jetonunu döner; yoksa cihaz kimliğiyle yeni oturum açar. */
  async ensureSession(): Promise<string | undefined> {
    if (!this.baseUrl) {
      return undefined;
    }
    if (this.token) {
      return this.token;
    }
    // Eşzamanlı çağrılar tek bir kimlik doğrulama isteğini paylaşır.
    this.pendingAuth ??= this.authenticate().finally(() => {
      this.pendingAuth = undefined;
    });
    return this.pendingAuth;
  }

  /**
   * Oturum açar.
   *
   * Önce YENİLEME denenir (kullanıcı giriş yapmışsa hesabı korunur); yenileme
   * yoksa ya da başarısızsa anonim oturuma düşülür. Bu sıralama önemlidir:
   * aksi halde jetonun süresi dolan bir kullanıcı sessizce misafire dönerdi.
   */
  private async authenticate(): Promise<string | undefined> {
    const refreshed = await this.refreshSession();
    if (refreshed) {
      return refreshed;
    }
    // Sunucu anonim oturuma kapalıysa tekrar denemenin anlamı yok.
    if (this.anonymousDisabled) {
      return undefined;
    }
    try {
      // Anonim oturum — kimlik bilgisi istemez.
      const session = await this.http.postJson<AuthSessionDto>(
        this.url('/v1/auth/device'),
        { deviceId: this.deviceId() },
      );
      return this.storeSession(session);
    } catch (error) {
      // 4xx = sunucu bu isteği kalıcı olarak reddediyor (ör. anonim giriş
      // kapalı). Ağ hatasından farklı olarak tekrar denenmez.
      if (error instanceof AppError && error.code === 'BAD_REQUEST') {
        this.anonymousDisabled = true;
        this.logger.info(
          'Anonim oturum sunucuda kapalı — senkron için hesapla giriş gerekiyor',
        );
        return undefined;
      }
      // Oturum açılamazsa uygulama çevrimdışı/yerel çalışmaya devam eder.
      this.logger.warn('Oturum açılamadı', error);
      return undefined;
    }
  }

  /** Yenileme jetonuyla erişim jetonunu tazeler; yoksa undefined. */
  private async refreshSession(): Promise<string | undefined> {
    if (!this.refreshToken) {
      return undefined;
    }
    try {
      const session = await this.http.postJson<AuthSessionDto>(this.url('/v1/auth/refresh'), {
        refreshToken: this.refreshToken,
      });
      return this.storeSession(session);
    } catch {
      // Yenileme jetonu da geçersiz: temizlenir, anonim oturuma düşülür.
      this.refreshToken = undefined;
      this.storage.delete(REFRESH_TOKEN_KEY);
      return undefined;
    }
  }

  /** Oturum yanıtını kalıcı olarak saklar. */
  private storeSession(session?: AuthSessionDto): string | undefined {
    if (!session?.token) {
      return undefined;
    }
    this.token = session.token;
    this.storage.set(TOKEN_KEY, session.token);
    if (session.refreshToken) {
      this.refreshToken = session.refreshToken;
      this.storage.set(REFRESH_TOKEN_KEY, session.refreshToken);
    }
    return session.token;
  }

  /** Cihaza özgü kalıcı anonim kimlik (kişisel veri içermez). */
  private deviceId(): string {
    const existing = this.storage.getString(DEVICE_ID_KEY);
    if (existing) {
      return existing;
    }
    const generated = `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    this.storage.set(DEVICE_ID_KEY, generated);
    return generated;
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.ensureSession();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Süresi dolmuş erişim jetonunu düşürür; YENİLEME jetonu korunur.
   *
   * Kimlik hâlâ geçerlidir, yalnızca kısa ömürlü jeton eskimiştir.
   */
  private clearAccessToken(): void {
    this.token = undefined;
    this.storage.delete(TOKEN_KEY);
  }

  /** Oturumu tümüyle kapatır (çıkış). Bir sonraki istekte anonim oturum açılır. */
  private clearToken(): void {
    this.clearAccessToken();
    this.refreshToken = undefined;
    this.storage.delete(REFRESH_TOKEN_KEY);
  }

  private url(path: string): string {
    return `${this.baseUrl?.replace(/\/+$/, '') ?? ''}${path}`;
  }
}
