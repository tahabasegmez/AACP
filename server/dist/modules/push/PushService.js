"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushService = void 0;
const errors_1 = require("../../core/errors");
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
class PushService {
    store;
    constructor(store) {
        this.store = store;
    }
    async register(userId, raw) {
        const o = (raw ?? {});
        const token = typeof o.token === 'string' ? o.token.trim() : '';
        const platform = typeof o.platform === 'string' ? o.platform.trim().toLowerCase() : '';
        if (!token || token.length > 512) {
            throw errors_1.HttpError.badRequest('token zorunlu (en fazla 512 karakter)');
        }
        if (!PLATFORMS.has(platform)) {
            throw errors_1.HttpError.badRequest(`platform "ios" veya "android" olmalı`);
        }
        await this.store.upsertPushRegistration({
            userId,
            token,
            platform,
            updatedAt: Date.now(),
        });
        return { ok: true };
    }
    async unregister(raw) {
        const o = (raw ?? {});
        const token = typeof o.token === 'string' ? o.token.trim() : '';
        if (!token) {
            throw errors_1.HttpError.badRequest('token zorunlu');
        }
        await this.store.removePushRegistration(token);
        return { ok: true };
    }
}
exports.PushService = PushService;
//# sourceMappingURL=PushService.js.map