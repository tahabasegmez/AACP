import { AppError, Result, ok } from '@core/error';
import { Logger } from '@core/logger';
import { HttpClient } from '@core/ports';
import { AdBreak, AdTrackingEvent } from '@domain/entities';
import { AdRepository, AdRequest } from '@domain/repositories';
import { mapVastToAdBreak, vastWrapperUri } from '../mappers';

/** VAST Wrapper zincirinde izlenecek en fazla adım (sonsuz döngü koruması). */
const MAX_WRAPPER_DEPTH = 4;
/** Reklam isteği için zaman aşımı — dinleme akışını bekletmemeli. */
const AD_TIMEOUT_MS = 5_000;

export interface VastAdRepositoryOptions {
  /**
   * Reklam etiketi (ad tag) URL'i. Reklam sunucusundan alınır ve hedefleme
   * parametreleriyle (bölüm/şov) doldurulur.
   *
   * Desteklenen yer tutucular: `{placement}`, `{episodeId}`, `{showId}`,
   * `{duration}`, `{timestamp}`, `{random}`
   */
  readonly adTagUrl: string;
}

/**
 * VastAdRepository — AdRepository portunun VAST implementasyonu.
 *
 * Sorumlulukları:
 *  - Ad tag URL'ini hedefleme parametreleriyle doldurup çağırmak,
 *  - VAST Wrapper zincirini (sınırlı derinlikte) izlemek,
 *  - Yanıtı domain `AdBreak`ine çevirmek,
 *  - İzleme (tracking) piksellerini ateşlemek.
 *
 * TASARIM İLKESİ: reklam alınamazsa bu bir HATA DEĞİLDİR. `ok(null)` döner ve
 * oynatma reklamsız devam eder. Reklam altyapısı hiçbir koşulda dinleme
 * deneyimini bloke etmemelidir.
 */
export class VastAdRepository implements AdRepository {
  constructor(
    private readonly http: HttpClient,
    private readonly logger: Logger,
    private readonly options: VastAdRepositoryOptions,
  ) {}

  async getAdBreak(request: AdRequest): Promise<Result<AdBreak | null>> {
    if (!this.options.adTagUrl) {
      return ok(null);
    }

    try {
      const url = this.buildTagUrl(request);
      const xml = await this.fetchVast(url, 0);
      if (!xml) {
        return ok(null);
      }
      return ok(mapVastToAdBreak(xml, request.placement));
    } catch (error) {
      // Reklam sunucusu erişilemez/bozuk: sessizce reklamsız devam.
      this.logger.warn('Reklam alınamadı', error);
      return ok(null);
    }
  }

  async trackEvent(
    adId: string,
    event: AdTrackingEvent,
    urls: readonly string[],
  ): Promise<void> {
    // İzleme best-effort ve paralel: hiçbiri oynatmayı bekletmez.
    await Promise.all(
      urls.map(async url => {
        try {
          await this.http.getText(url, { timeoutMs: AD_TIMEOUT_MS });
        } catch (error) {
          this.logger.debug('Reklam izleme isteği başarısız', adId, event, error);
        }
      }),
    );
  }

  /**
   * VAST yanıtını getirir; Wrapper ise zinciri izler.
   * Derinlik sınırına ulaşılırsa undefined döner (reklam yok sayılır).
   */
  private async fetchVast(url: string, depth: number): Promise<string | undefined> {
    if (depth > MAX_WRAPPER_DEPTH) {
      this.logger.warn('VAST wrapper zinciri çok derin, vazgeçildi');
      return undefined;
    }

    const xml = await this.http.getText(url, { timeoutMs: AD_TIMEOUT_MS });
    if (!xml.includes('<VAST')) {
      throw AppError.parse('Yanıt VAST değil');
    }

    const wrapper = vastWrapperUri(xml);
    return wrapper ? this.fetchVast(wrapper, depth + 1) : xml;
  }

  /** Ad tag URL'indeki yer tutucuları istek bağlamıyla doldurur. */
  private buildTagUrl(request: AdRequest): string {
    const values: Record<string, string> = {
      placement: request.placement,
      episodeId: request.episodeId,
      showId: request.showId,
      duration: String(Math.round(request.episodeDurationSec ?? 0)),
      timestamp: String(Date.now()),
      // Cache-busting — reklam sunucuları genellikle bunu bekler.
      random: String(Math.floor(Math.random() * 1e10)),
    };

    return this.options.adTagUrl.replace(/\{(\w+)\}/g, (match, key: string) =>
      key in values ? encodeURIComponent(values[key]) : match,
    );
  }
}
