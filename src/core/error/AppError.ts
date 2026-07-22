/**
 * Uygulama genelinde tek tip hata modeli.
 *
 * Her hata bir `code` taşır; UI bu koda göre kullanıcıya uygun mesaj gösterir.
 * `cause` orijinal hatayı (ör. network exception) saklar, loglama için.
 */
export type AppErrorCode =
  | 'NETWORK'
  | 'PARSE'
  | 'NOT_FOUND'
  | 'TIMEOUT'
  | 'STORAGE'
  | 'PLAYBACK'
  | 'UNKNOWN';

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly cause?: unknown;

  constructor(code: AppErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.cause = cause;
  }

  static network(message = 'Ağ hatası', cause?: unknown): AppError {
    return new AppError('NETWORK', message, cause);
  }

  static parse(message = 'Veri ayrıştırma hatası', cause?: unknown): AppError {
    return new AppError('PARSE', message, cause);
  }

  static notFound(message = 'Bulunamadı', cause?: unknown): AppError {
    return new AppError('NOT_FOUND', message, cause);
  }

  static from(cause: unknown, code: AppErrorCode = 'UNKNOWN'): AppError {
    if (cause instanceof AppError) {
      return cause;
    }
    const message = cause instanceof Error ? cause.message : String(cause);
    return new AppError(code, message, cause);
  }
}
