import crypto from 'node:crypto';
import { HttpError } from '../../core/errors';
import type { Store } from '../../storage/Store';
import { createToken, verifyToken } from './tokens';

export interface AuthSession {
  readonly token: string;
  readonly userId: string;
  readonly expiresInSec: number;
}

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

    return {
      token: createToken(user.id, this.secret, this.tokenTtlSec),
      userId: user.id,
      expiresInSec: this.tokenTtlSec,
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
