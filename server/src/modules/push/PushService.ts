import { HttpError } from '../../core/errors';
import type { Store } from '../../storage/Store';

const PLATFORMS = new Set(['ios', 'android']);

/**
 * PushService — cihaz push jetonlarının kaydı.
 *
 * KAPSAM: bu servis yalnızca jeton KAYDINI tutar. Bildirimlerin fiilen
 * gönderilmesi (APNs/FCM'e bağlanan gönderici + yeni bölümleri saptayan
 * zamanlanmış görev) ayrı bir çalışan (worker) olarak eklenecektir; sözleşme
 * hazır olduğu için o iş bu API'yi değiştirmez.
 *
 * Bkz. docs/BACKEND.md — "Push (eksik parçalar)".
 */
export class PushService {
  constructor(private readonly store: Store) {}

  async register(userId: string, raw: unknown): Promise<{ ok: true }> {
    const o = (raw ?? {}) as Record<string, unknown>;
    const token = typeof o.token === 'string' ? o.token.trim() : '';
    const platform = typeof o.platform === 'string' ? o.platform.trim().toLowerCase() : '';

    if (!token || token.length > 512) {
      throw HttpError.badRequest('token zorunlu (en fazla 512 karakter)');
    }
    if (!PLATFORMS.has(platform)) {
      throw HttpError.badRequest(`platform "ios" veya "android" olmalı`);
    }

    await this.store.upsertPushRegistration({
      userId,
      token,
      platform,
      updatedAt: Date.now(),
    });
    return { ok: true };
  }

  async unregister(raw: unknown): Promise<{ ok: true }> {
    const o = (raw ?? {}) as Record<string, unknown>;
    const token = typeof o.token === 'string' ? o.token.trim() : '';
    if (!token) {
      throw HttpError.badRequest('token zorunlu');
    }
    await this.store.removePushRegistration(token);
    return { ok: true };
  }
}
