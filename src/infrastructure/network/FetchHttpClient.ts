import { AppError } from '@core/error';
import { HttpClient } from '@core/ports';

/**
 * FetchHttpClient — HttpClient portunun fetch tabanlı implementasyonu.
 *
 * Zaman aşımı (AbortController) ve hata → AppError dönüşümü burada. Harici bir
 * HTTP kütüphanesine (axios) geçilmek istenirse yalnızca bu dosya değişir.
 */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly timeoutMs: number) {}

  async getText(url: string): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      if (!response.ok) {
        throw AppError.network(`HTTP ${response.status} — ${url}`);
      }
      return await response.text();
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      if ((error as Error)?.name === 'AbortError') {
        throw new AppError('TIMEOUT', `İstek zaman aşımına uğradı — ${url}`);
      }
      throw AppError.network(`Ağ isteği başarısız — ${url}`, error);
    } finally {
      clearTimeout(timeout);
    }
  }
}
