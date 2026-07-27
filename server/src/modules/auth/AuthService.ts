import crypto from 'node:crypto';
import { HttpError } from '../../core/errors';
import type { Store, UserRecord } from '../../storage/Store';
import { hashPassword, verifyPassword } from './password';
import { createToken, verifyToken } from './tokens';

/** E-postayı karşılaştırmaya uygun hale getirir (küçük harf, kırpılmış). */
const normalizeEmail = (email: string): string => (email ?? '').trim().toLowerCase();

/** Gizli alanları ayıklayıp istemciye dönülebilir profili üretir. */
const toPublicUser = (user: UserRecord): PublicUser => ({
  id: user.id,
  email: user.email,
  displayName: user.displayName,
  createdAt: user.createdAt,
});

export interface AuthSession {
  readonly token: string;
  readonly userId: string;
  readonly expiresInSec: number;
  /** Oturumun ait olduğu kullanıcının herkese açık profili. */
  readonly user: PublicUser;
}

/** İstemciye dönen kullanıcı bilgisi — gizli alanlar (şifre özeti) taşınmaz. */
export interface PublicUser {
  readonly id: string;
  readonly email?: string;
  readonly displayName?: string;
  readonly createdAt: number;
}

/** Şifre için asgari uzunluk — istemcideki kuralla aynı tutulmalı. */
const MIN_PASSWORD_LENGTH = 8;

/**
 * AuthService — cihaz tabanlı anonim kimlik.
 *
 * Kullanıcıdan e-posta/şifre istemeden cihazlar arası senkronu mümkün kılar:
 * uygulama ilk açılışta rastgele bir `deviceId` üretir, sunucu buna karşılık
 * kalıcı bir kullanıcı ve imzalı bir jeton döner. İleride e-posta ile hesap
 * eklenmek istenirse aynı kullanıcı kaydına bağlanır (deviceId korunur).
 */
export class AuthService {
  constructor(
    private readonly store: Store,
    private readonly secret: string,
    private readonly tokenTtlSec: number,
  ) {}

  /** Cihaz kimliğiyle oturum açar; kullanıcı yoksa oluşturur. */
  async authenticateDevice(deviceId: string): Promise<AuthSession> {
    const trimmed = deviceId?.trim();
    if (!trimmed || trimmed.length < 8 || trimmed.length > 128) {
      throw HttpError.badRequest('deviceId 8-128 karakter olmalı');
    }

    let user = await this.store.findUserByDeviceId(trimmed);
    if (!user) {
      user = { id: crypto.randomUUID(), deviceId: trimmed, createdAt: Date.now() };
      await this.store.createUser(user);
    }

    return this.sessionFor(user);
  }

  /**
   * Hesap oluşturur.
   *
   * `currentUserId` verilmişse (kullanıcı anonim olarak kullanıyorduysa) YENİ
   * kullanıcı yaratılmaz; mevcut kayıt e-posta ile YÜKSELTİLİR. Böylece
   * anonimken biriken tüm veri (kaldığın yer, takipler, listeler) hesaba
   * doğal olarak taşınır — ayrıca bir taşıma adımı gerekmez.
   */
  async register(
    email: string,
    password: string,
    currentUserId?: string,
  ): Promise<AuthSession> {
    const normalized = normalizeEmail(email);
    this.assertCredentials(normalized, password);

    if (await this.store.findUserByEmail(normalized)) {
      throw HttpError.badRequest('Bu e-posta zaten kayıtlı');
    }

    const passwordHash = await hashPassword(password);

    // Anonim kullanıcı varsa onu yükselt.
    if (currentUserId) {
      const existing = await this.store.findUserById(currentUserId);
      if (existing && !existing.email) {
        await this.store.updateUser(existing.id, { email: normalized, passwordHash });
        return this.sessionFor({ ...existing, email: normalized, passwordHash });
      }
    }

    const user = {
      id: crypto.randomUUID(),
      email: normalized,
      passwordHash,
      createdAt: Date.now(),
    };
    await this.store.createUser(user);
    return this.sessionFor(user);
  }

  /** E-posta + şifre ile giriş. */
  async signIn(email: string, password: string): Promise<AuthSession> {
    const normalized = normalizeEmail(email);
    const user = await this.store.findUserByEmail(normalized);

    // Kullanıcı yok ya da şifre yanlış — ikisi de AYNI mesajı döner ki
    // hangi e-postaların kayıtlı olduğu sızmasın.
    if (!user?.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
      throw HttpError.unauthorized('E-posta veya şifre hatalı');
    }
    return this.sessionFor(user);
  }

  /** Oturumdaki kullanıcının profili. */
  async profile(userId: string): Promise<PublicUser> {
    const user = await this.store.findUserById(userId);
    if (!user) {
      throw HttpError.unauthorized('Oturum geçersiz');
    }
    return toPublicUser(user);
  }

  /** Profil günceller (şimdilik yalnızca görünen ad). */
  async updateProfile(userId: string, displayName?: string): Promise<PublicUser> {
    const trimmed = displayName?.trim();
    if (trimmed !== undefined && trimmed.length > 60) {
      throw HttpError.badRequest('Ad en fazla 60 karakter olabilir');
    }
    await this.store.updateUser(userId, { displayName: trimmed });
    return this.profile(userId);
  }

  private assertCredentials(email: string, password: string): void {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw HttpError.badRequest('Geçerli bir e-posta girin');
    }
    if (!password || password.length < MIN_PASSWORD_LENGTH) {
      throw HttpError.badRequest(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı`);
    }
  }

  private sessionFor(user: UserRecord): AuthSession {
    return {
      token: createToken(user.id, this.secret, this.tokenTtlSec),
      userId: user.id,
      expiresInSec: this.tokenTtlSec,
      user: toPublicUser(user),
    };
  }

  /** `Authorization: Bearer <token>` başlığından kullanıcı kimliğini çözer. */
  userIdFromHeader(header: string | string[] | undefined): string | undefined {
    const value = Array.isArray(header) ? header[0] : header;
    if (!value?.toLowerCase().startsWith('bearer ')) {
      return undefined;
    }
    return verifyToken(value.slice(7).trim(), this.secret);
  }

  /** Kimlik zorunlu olan uçlar için: yoksa 401. */
  requireUserId(header: string | string[] | undefined): string {
    const userId = this.userIdFromHeader(header);
    if (!userId) {
      throw HttpError.unauthorized('Bu uç için oturum gerekli');
    }
    return userId;
  }
}
