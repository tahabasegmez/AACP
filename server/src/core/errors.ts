/**
 * HttpError — durum kodu taşıyan uygulama hatası.
 *
 * Servis katmanı bunu fırlatır; router tek bir yerde JSON hata yanıtına çevirir.
 * Böylece her handler'da tekrar eden try/catch olmaz.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code = 'ERROR',
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message = 'Geçersiz istek'): HttpError {
    return new HttpError(400, message, 'BAD_REQUEST');
  }

  static unauthorized(message = 'Yetkisiz'): HttpError {
    return new HttpError(401, message, 'UNAUTHORIZED');
  }

  static forbidden(message = 'Erişim reddedildi'): HttpError {
    return new HttpError(403, message, 'FORBIDDEN');
  }

  static notFound(message = 'Bulunamadı'): HttpError {
    return new HttpError(404, message, 'NOT_FOUND');
  }

  static tooManyRequests(message = 'Çok fazla istek'): HttpError {
    return new HttpError(429, message, 'RATE_LIMITED');
  }

  static internal(message = 'Sunucu hatası'): HttpError {
    return new HttpError(500, message, 'INTERNAL');
  }
}
