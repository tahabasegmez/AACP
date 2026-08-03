import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import { User, isValidEmail, isValidPassword } from '@domain/entities';
import { AvatarUpload, CredentialsInput, UserRepository } from '@domain/repositories';

/** Kullanıcı profilinin yerel önbelleği — çevrimdışı açılışta da bilinsin. */
const USER_KEY = 'aacp.user.profile';

/** Sunucudan dönen oturum yanıtı. */
interface AuthSessionDto {
  readonly token?: string;
  readonly refreshToken?: string;
  readonly userId?: string;
  readonly user?: PublicUserDto;
  /** E-posta doğrulaması açıksa kayıt jeton döndürmez. */
  readonly pendingEmailConfirmation?: boolean;
}

interface PublicUserDto {
  readonly id?: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly avatarUrl?: string;
  readonly createdAt?: number;
}

/** Sunucu tarafı API'nin ihtiyaç duyulan yüzeyi (bağımlılığı daraltır). */
export interface UserApi {
  readonly enabled: boolean;
  post<T>(path: string, body: unknown): Promise<T | undefined>;
  get<T>(path: string): Promise<T | undefined>;
  setToken(token?: string, refreshToken?: string): void;
  getDeviceId(): string;
  ensureSession(): Promise<string | undefined>;
}

/**
 * UserRepository'nin somut implementasyonu.
 *
 * Kimlik sunucuda yaşar; burada yalnızca çağrılar ve YEREL ÖNBELLEK yönetilir.
 * Profil önbelleği sayesinde uygulama çevrimdışı açıldığında da kullanıcının
 * kim olduğu bilinir (yalnızca gösterim amaçlı; yetki her zaman sunucuda).
 *
 * Sunucu yapılandırılmamışsa (`api.enabled === false`) hesap işlemleri
 * "kullanılamıyor" hatası döner ve uygulama tamamen yerel çalışır.
 */
export class UserRepositoryImpl implements UserRepository {
  constructor(
    private readonly api: UserApi,
    private readonly storage: KeyValueStorage,
  ) {}

  get accountsAvailable(): boolean {
    return this.api.enabled;
  }

  async current(): Promise<Result<User | null>> {
    // Sunucu kapalıysa yalnızca önbellekteki profil bilinir.
    if (!this.api.enabled) {
      return ok(this.readCache());
    }
    try {
      const dto = await this.api.get<PublicUserDto>('/v1/auth/me');
      if (!dto?.id) {
        return ok(this.readCache());
      }
      const user = toUser(dto);
      this.writeCache(user);
      return ok(user);
    } catch {
      // Ağ hatasında önbellekle devam — oturum kapatılmaz.
      return ok(this.readCache());
    }
  }

  async signInAnonymously(): Promise<Result<User>> {
    if (!this.api.enabled) {
      return fail(AppError.validation('Sunucu yapılandırılmadığı için hesap işlemleri kapalı'));
    }
    try {
      await this.api.ensureSession();
      const dto = await this.api.get<PublicUserDto>('/v1/auth/me');
      if (!dto?.id) {
        return fail(AppError.network('Oturum açılamadı'));
      }
      const user = toUser(dto);
      this.writeCache(user);
      return ok(user);
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  async register(input: CredentialsInput): Promise<Result<User>> {
    const invalid = validate(input);
    if (invalid) {
      return fail(invalid);
    }
    // Kayıt, MEVCUT (anonim) oturumun başlığıyla gider; sunucu o kullanıcıyı
    // yükseltir ve anonimken biriken veri hesaba taşınmış olur.
    return this.authenticate('/v1/auth/register', input);
  }

  async signIn(input: CredentialsInput): Promise<Result<User>> {
    const invalid = validate(input);
    if (invalid) {
      return fail(invalid);
    }
    return this.authenticate('/v1/auth/login', input);
  }

  async signOut(): Promise<Result<void>> {
    // Jeton ve profil önbelleği silinir; bir sonraki istekte cihaz kimliğiyle
    // yeni bir anonim oturum açılır (uygulama kullanılmaya devam eder).
    this.api.setToken(undefined);
    this.storage.delete(USER_KEY);
    return ok(undefined);
  }

  async updateProfile(input: { displayName?: string }): Promise<Result<User>> {
    if (!this.api.enabled) {
      return fail(AppError.validation('Sunucu yapılandırılmadığı için profil güncellenemez'));
    }
    try {
      const dto = await this.api.post<PublicUserDto>('/v1/auth/profile', input);
      if (!dto?.id) {
        return fail(AppError.network('Profil güncellenemedi'));
      }
      const user = toUser(dto);
      this.writeCache(user);
      return ok(user);
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  async uploadAvatar(input: AvatarUpload): Promise<Result<User>> {
    if (!this.api.enabled) {
      return fail(AppError.validation('Sunucu yapılandırılmadığı için fotoğraf yüklenemez'));
    }
    try {
      const dto = await this.api.post<PublicUserDto>('/v1/auth/avatar', input);
      if (!dto?.id) {
        return fail(AppError.network('Fotoğraf yüklenemedi'));
      }
      const user = toUser(dto);
      this.writeCache(user);
      return ok(user);
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  /** Kayıt/giriş ortak akışı: oturum al, jetonu kur, profili önbelleğe yaz. */
  private async authenticate(path: string, input: CredentialsInput): Promise<Result<User>> {
    if (!this.api.enabled) {
      return fail(AppError.validation('Sunucu yapılandırılmadığı için hesap işlemleri kapalı'));
    }
    try {
      const session = await this.api.post<AuthSessionDto>(path, {
        email: input.email.trim().toLowerCase(),
        password: input.password,
      });

      // Sunucuda e-posta doğrulaması açıksa oturum hemen açılmaz.
      if (session?.pendingEmailConfirmation) {
        return fail(
          AppError.validation(
            'Hesabını doğrulamak için e-postana gönderdiğimiz bağlantıya tıkla.',
          ),
        );
      }

      if (!session?.token || !session.user?.id) {
        return fail(AppError.network('Oturum açılamadı'));
      }
      this.api.setToken(session.token, session.refreshToken);
      const user = toUser(session.user);
      this.writeCache(user);
      return ok(user);
    } catch (error) {
      return fail(AppError.from(error, 'NETWORK'));
    }
  }

  private readCache(): User | null {
    const raw = this.storage.getString(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as User;
      return parsed?.id ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeCache(user: User): void {
    this.storage.set(USER_KEY, JSON.stringify(user));
  }
}

/** Girdi doğrulaması — sunucuya gitmeden hızlı geri bildirim. */
const validate = (input: CredentialsInput): AppError | undefined => {
  if (!isValidEmail(input.email)) {
    return AppError.validation('Geçerli bir e-posta girin');
  }
  if (!isValidPassword(input.password)) {
    return AppError.validation('Şifre en az 8 karakter olmalı');
  }
  return undefined;
};

const toUser = (dto: PublicUserDto): User => ({
  id: dto.id ?? '',
  email: dto.email,
  displayName: dto.displayName,
  avatarUrl: dto.avatarUrl,
  createdAt: dto.createdAt ?? Date.now(),
});
