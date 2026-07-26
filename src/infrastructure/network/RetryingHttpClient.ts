import { AppError } from '@core/error';
import { HttpClient, HttpRequestOptions } from '@core/ports';

/**
 * RetryingHttpClient — bir HttpClient'ı sarıp geçici hatalarda yeniden dener (decorator).
 *
 * Retry'ı VERİ KATMANINDA tutmanın avantajı: hem TanStack Query (mobil UI) hem de
 * CarPlay gibi use case'leri doğrudan çağıran yüzeyler aynı retry davranışını
 * paylaşır. (Bu yüzden React Query'nin kendi retry'ı kapalıdır — çift retry olmasın.)
 *
 * Yalnızca geçici hatalar (NETWORK/TIMEOUT) yeniden denenir; PARSE/NOT_FOUND/
 * UNAUTHORIZED gibi kalıcı hatalar anında yukarı verilir. Doğrusal artan kısa bir
 * bekleme uygulanır.
 */
export class RetryingHttpClient implements HttpClient {
  constructor(
    private readonly inner: HttpClient,
    private readonly maxRetries: number,
    private readonly baseDelayMs = 400,
  ) {}

  getText(url: string, options?: HttpRequestOptions): Promise<string> {
    return this.withRetry(() => this.inner.getText(url, options));
  }

  postJson<TResponse, TBody = unknown>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions,
  ): Promise<TResponse | undefined> {
    return this.withRetry(() => this.inner.postJson<TResponse, TBody>(url, body, options));
  }

  /** Verilen isteği geçici hatalarda sınırlı sayıda yeniden dener. */
  private async withRetry<T>(run: () => Promise<T>): Promise<T> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await run();
      } catch (error) {
        lastError = error;
        if (!isRetryable(error) || attempt === this.maxRetries) {
          break;
        }
        await delay(this.baseDelayMs * (attempt + 1));
      }
    }
    throw AppError.from(lastError, 'NETWORK');
  }
}

const isRetryable = (error: unknown): boolean =>
  error instanceof AppError &&
  (error.code === 'NETWORK' || error.code === 'TIMEOUT');

const delay = (ms: number): Promise<void> =>
  ms > 0 ? new Promise<void>(resolve => setTimeout(resolve, ms)) : Promise.resolve();
