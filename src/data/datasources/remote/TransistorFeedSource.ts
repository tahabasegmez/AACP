import { AppError } from '@core/error';
import { HttpClient } from '@core/ports';
import { PodcastFeed } from '@domain/entities';
import {
  TransistorCollection,
  TransistorEpisodeAttributes,
  TransistorEpisodeDto,
  TransistorShowAttributes,
} from '../../dto';
import { mapTransistorFeed } from '../../mappers';
import { FeedSource } from './FeedSource';

/** Transistor API kök adresi (v1). */
const DEFAULT_BASE_URL = 'https://api.transistor.fm/v1';
/** Tek seferde çekilecek bölüm sayısı (API üst sınırı). */
const PAGE_SIZE = 50;
/** En fazla kaç sayfa gezilecek — kontrolsüz döngüye karşı emniyet. */
const MAX_PAGES = 20;

export interface TransistorFeedSourceOptions {
  /** API anahtarı. Backend proxy'si kullanılıyorsa boş bırakılabilir. */
  readonly apiKey?: string;
  /** Kök adres. Backend proxy'si için ör. `${apiBaseUrl}/v1/transistor`. */
  readonly baseUrl?: string;
}

/**
 * TransistorFeedSource — FeedSource'un Transistor API implementasyonu.
 *
 * RSS yerine resmi API'den okur: sayfalı bölüm listesi, yayın durumu filtresi ve
 * daha zengin meta veri. Kullanıma alınması için DI'da RssFeedSource yerine bunu
 * bağlamak yeterlidir (`env.episodeSource = 'transistor'`); repository ve üstü
 * hiç değişmez.
 *
 * GÜVENLİK NOTU: API anahtarını istemciye gömmek yerine backend proxy'si
 * (`baseUrl` = kendi sunucumuz) önerilir; anahtar sunucuda kalır.
 */
export class TransistorFeedSource implements FeedSource {
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpClient,
    private readonly options: TransistorFeedSourceOptions = {},
  ) {
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
  }

  async fetchFeed(feedUrl: string): Promise<PodcastFeed> {
    const showId = slugFromFeedUrl(feedUrl);
    if (!showId) {
      throw AppError.notFound(`Transistor şovu çözülemedi — ${feedUrl}`);
    }

    const shows = await this.get<TransistorCollection<TransistorShowAttributes>>('/shows');
    const show = (shows.data ?? []).find(
      s => s.attributes?.slug === showId || slugFromFeedUrl(s.attributes?.feed_url ?? '') === showId,
    );
    if (!show?.id) {
      throw AppError.notFound(`Transistor şovu bulunamadı — ${showId}`);
    }

    const episodes = await this.fetchAllEpisodes(show.id);
    return mapTransistorFeed(show, episodes, feedUrl);
  }

  /** Bölümleri sayfa sayfa toplar (meta.totalPages'e göre, sınırlı). */
  private async fetchAllEpisodes(showId: string): Promise<TransistorEpisodeDto[]> {
    const all: TransistorEpisodeDto[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await this.get<TransistorCollection<TransistorEpisodeAttributes>>(
        `/episodes?show_id=${encodeURIComponent(showId)}&pagination[page]=${page}&pagination[per]=${PAGE_SIZE}`,
      );
      const batch = res.data ?? [];
      all.push(...batch);

      const totalPages = res.meta?.totalPages ?? 1;
      if (batch.length === 0 || page >= totalPages) {
        break;
      }
    }
    return all;
  }

  /** API'ye kimlikli GET yapar ve JSON'a çözer. */
  private async get<T>(path: string): Promise<T> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.options.apiKey) {
      headers['x-api-key'] = this.options.apiKey;
    }
    const text = await this.http.getText(`${this.baseUrl}${path}`, { headers });
    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw AppError.parse('Transistor yanıtı ayrıştırılamadı', error);
    }
  }
}

/** Feed URL'inin son parçası = Transistor slug'ı. */
const slugFromFeedUrl = (feedUrl: string): string => {
  const cleaned = feedUrl.split('?')[0].replace(/\/+$/, '');
  return cleaned.substring(cleaned.lastIndexOf('/') + 1);
};
