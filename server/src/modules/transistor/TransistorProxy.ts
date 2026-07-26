import { HttpError } from '../../core/errors';

/** Proxy'lenmesine izin verilen yollar — açık liste (SSRF'e karşı). */
const ALLOWED_PATHS = new Set(['shows', 'episodes']);
/** Kısa süreli önbellek: aynı yanıtı tekrar tekrar çekmeyelim. */
const CACHE_TTL_MS = 5 * 60_000;

interface CacheEntry {
  readonly body: string;
  readonly expiresAt: number;
}

/**
 * TransistorProxy — Transistor API'sine sunucu üzerinden erişim.
 *
 * AMAÇ: API anahtarını istemciye gömmemek. Uygulama `episodeSource=transistor`
 * ile çalıştığında istekleri buraya yapar; anahtar yalnızca sunucuda durur.
 *
 * Ayrıca kısa süreli bir önbellek uygular; Transistor'ın oran sınırlarına
 * takılmadan çok sayıda istemciye hizmet verilebilir.
 */
export class TransistorProxy {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string | undefined,
    private readonly timeoutMs = 15_000,
  ) {}

  get enabled(): boolean {
    return Boolean(this.apiKey);
  }

  /**
   * `resource` (shows|episodes) ve sorgu parametrelerini Transistor'a iletir.
   * Yanıt gövdesi olduğu gibi döner — dönüşüm istemcide yapılır.
   */
  async forward(resource: string, query: URLSearchParams): Promise<string> {
    if (!this.apiKey) {
      throw HttpError.forbidden('Transistor proxy yapılandırılmamış (TRANSISTOR_API_KEY yok)');
    }
    if (!ALLOWED_PATHS.has(resource)) {
      throw HttpError.badRequest(`Desteklenmeyen kaynak: ${resource}`);
    }

    const url = `${this.baseUrl.replace(/\/+$/, '')}/${resource}${
      query.toString() ? `?${query.toString()}` : ''
    }`;

    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.body;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { 'x-api-key': this.apiKey, Accept: 'application/json' },
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new HttpError(response.status >= 500 ? 502 : response.status, 'Transistor isteği başarısız');
      }
      const body = await response.text();
      this.cache.set(url, { body, expiresAt: Date.now() + CACHE_TTL_MS });
      return body;
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new HttpError(504, 'Transistor yanıt vermedi');
    } finally {
      clearTimeout(timer);
    }
  }
}
