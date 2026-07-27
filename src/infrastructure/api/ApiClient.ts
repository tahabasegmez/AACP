import { AppError } from '@core/error';
import { Logger } from '@core/logger';
import { HttpClient, KeyValueStorage } from '@core/ports';

const DEVICE_ID_KEY = 'aacp.device.id';
const TOKEN_KEY = 'aacp.auth.token';

interface AuthSessionDto {
  readonly token?: string;
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
  /** Aynı anda birden çok isteğin kimlik doğrulamaya girmesini önler. */
  private pendingAuth?: Promise<string | undefined>;

  constructor(
    private readonly http: HttpClient,
    private readonly storage: KeyValueStorage,
    private readonly logger: Logger,
    private readonly baseUrl?: string,
  ) {
    this.token = storage.getString(TOKEN_KEY) ?? undefined;
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
        this.clearToken();
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
   * `undefined` verilirse oturum kapatılır ve bir sonraki istekte cihaz
   * kimliğiyle yeniden anonim oturum açılır.
   */
  setToken(token?: string): void {
    if (token) {
      this.token = token;
      this.storage.set(TOKEN_KEY, token);
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

  private async authenticate(): Promise<string | undefined> {
    try {
      const session = await this.http.postJson<AuthSessionDto>(
        this.url('/v1/auth/device'),
        { deviceId: this.deviceId() },
      );
      if (session?.token) {
        this.token = session.token;
        this.storage.set(TOKEN_KEY, session.token);
        return session.token;
      }
    } catch (error) {
      // Oturum açılamazsa uygulama çevrimdışı/yerel çalışmaya devam eder.
      this.logger.warn('Oturum açılamadı', error);
    }
    return undefined;
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

  private clearToken(): void {
    this.token = undefined;
    this.storage.delete(TOKEN_KEY);
  }

  private url(path: string): string {
    return `${this.baseUrl?.replace(/\/+$/, '') ?? ''}${path}`;
  }
}
