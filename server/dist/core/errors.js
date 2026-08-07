"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpError = void 0;
/**
 * HttpError — durum kodu taşıyan uygulama hatası.
 *
 * Servis katmanı bunu fırlatır; router tek bir yerde JSON hata yanıtına çevirir.
 * Böylece her handler'da tekrar eden try/catch olmaz.
 */
class HttpError extends Error {
    status;
    code;
    constructor(status, message, code = 'ERROR') {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'HttpError';
    }
    static badRequest(message = 'Geçersiz istek') {
        return new HttpError(400, message, 'BAD_REQUEST');
    }
    static unauthorized(message = 'Yetkisiz') {
        return new HttpError(401, message, 'UNAUTHORIZED');
    }
    static forbidden(message = 'Erişim reddedildi') {
        return new HttpError(403, message, 'FORBIDDEN');
    }
    static notFound(message = 'Bulunamadı') {
        return new HttpError(404, message, 'NOT_FOUND');
    }
    static tooManyRequests(message = 'Çok fazla istek') {
        return new HttpError(429, message, 'RATE_LIMITED');
    }
    static internal(message = 'Sunucu hatası') {
        return new HttpError(500, message, 'INTERNAL');
    }
}
exports.HttpError = HttpError;
//# sourceMappingURL=errors.js.map