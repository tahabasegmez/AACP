import { AppError } from '@core/error';
import { HttpClient, HttpRequestOptions } from '@core/ports';

const XML_ACCEPT = 'application/rss+xml, application/xml, text/xml';

/**
 * FetchHttpClient — HttpClient portunun fetch tabanlı implementasyonu.
 *
 * Zaman aşımı (AbortController) ve hata → AppError dönüşümü burada. Harici bir
 * HTTP kütüphanesine (axios) geçilmek istenirse yalnızca bu dosya değişir.
 */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly timeoutMs: number) {}

  async getText(url: string, options?: HttpRequestOptions): Promise<string> {
    const response = await this.send(url, {
      method: 'GET',
      headers: { Accept: XML_ACCEPT, ...(options?.headers ?? {}) },
      timeoutMs: options?.timeoutMs,
    });
    return response.text();
  }

  async postJson<TResponse, TBody = unknown>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions,
  ): Promise<TResponse | undefined> {
    const response = await this.send(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options?.headers ?? {}),
      },
      body: JSON.stringify(body),
      timeoutMs: options?.timeoutMs,
    });

    const text = await response.text();
    if (!text) {
      return undefined;
    }
    try {
      return JSON.parse(text) as TResponse;
    } catch (error) {
      throw AppError.parse(`Yanıt JSON olarak ayrıştırılamadı — ${url}`, error);
    }
  }

  /** Ortak istek yürütücü: zaman aşımı, durum kontrolü ve hata dönüşümü. */
  private async send(
    url: string,
    init: {
      method: string;
      headers: Record<string, string>;
      body?: string;
      timeoutMs?: number;
    },
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? this.timeoutMs);
    try {
      const response = await fetch(url, {
        method: init.method,
        headers: init.headers,
        body: init.body,
        signal: controller.signal,
      });
      if (!response.ok) {
        throw httpError(response.status, url);
      }
      return response;
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

/**
 * HTTP durum kodunu anlamlı bir AppError'a çevirir. 4xx kalıcıdır (retry edilmez),
 * 5xx geçicidir (NETWORK → retry edilir).
 */
const httpError = (status: number, url: string): AppError => {
  if (status === 401 || status === 403) {
    return new AppError('UNAUTHORIZED', `Yetkisiz istek (${status}) — ${url}`);
  }
  if (status === 404) {
    return new AppError('NOT_FOUND', `Bulunamadı (404) — ${url}`);
  }
  if (status >= 400 && status < 500) {
    return new AppError('BAD_REQUEST', `İstek reddedildi (${status}) — ${url}`);
  }
  return AppError.network(`HTTP ${status} — ${url}`);
};
