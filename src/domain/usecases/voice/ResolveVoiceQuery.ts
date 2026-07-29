import { Result, ok } from '@core/error';
import { Episode, Show } from '../../entities';
import { PodcastFeedRepository, ShowCatalogRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface VoiceQueryParams {
  /** Kullanıcının söylediği metin ("Bir bakışta çal", "son bölümü aç"). */
  readonly query: string;
}

/** Sesli sorgunun çözümü — ne çalınacağı ve neden. */
export interface VoiceQueryMatch {
  readonly episode: Episode;
  /** Bölümün ait olduğu şov (geri bildirim metni için). */
  readonly show?: Show;
  /**
   * Eşleşmenin nasıl bulunduğu — arayüz kullanıcıya ne söyleyeceğine buna
   * göre karar verir ("X çalınıyor" / "X şovunun son bölümü çalınıyor").
   */
  readonly kind: 'episode' | 'showLatest';
}

/** Türkçe duyarlı, aksan/büyük-küçük farkını yok sayan normalleştirme. */
const normalize = (value: string): string =>
  value
    .toLocaleLowerCase('tr-TR')
    .replace(/[İIıi]/g, 'i')
    .replace(/[ğg]/g, 'g')
    .replace(/[üu]/g, 'u')
    .replace(/[şs]/g, 's')
    .replace(/[öo]/g, 'o')
    .replace(/[çc]/g, 'c')
    .replace(/[^\p{L}\p{N} ]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Sorgudan komut kelimelerini ayıklar.
 *
 * Siri sorguları genelde "… çal", "… oynat", "… aç" biçiminde gelir; bu
 * kelimeler eşleştirmeyi bozar çünkü hiçbir şov adında geçmezler.
 */
const COMMAND_WORDS = ['cal', 'oynat', 'ac', 'baslat', 'dinle', 'podcast', 'bolum'];

const stripCommands = (normalized: string): string =>
  normalized
    .split(' ')
    .filter(word => !COMMAND_WORDS.includes(word))
    .join(' ')
    .trim();

/** Bir metin sorguyu içeriyor mu (ya da tersi) — kısmi eşleşme. */
const matches = (haystack: string, needle: string): boolean => {
  if (!needle) {
    return false;
  }
  const a = normalize(haystack);
  return a.includes(needle) || needle.includes(a);
};

/**
 * ResolveVoiceQuery — sesli bir isteği çalınabilir bir bölüme çevirir.
 *
 * Sıralama bilinçlidir ve kullanıcının niyetini yansıtır:
 *   1. **Şov adı** eşleşmesi → o şovun EN SON bölümü (en sık istenen şey),
 *   2. **Bölüm başlığı** eşleşmesi → o bölüm,
 *   3. Sorgu boşsa ("podcast çal") → katalogdaki ilk şovun son bölümü.
 *
 * Saf domain mantığıdır: Siri'yi, CarPlay'i ya da native intent'leri BİLMEZ.
 * Bu sayede aynı çözümleyici sesli komut, arama kutusu ya da derin bağlantı
 * için yeniden kullanılabilir; platform katmanı yalnızca metni iletir.
 */
export class ResolveVoiceQuery implements UseCase<VoiceQueryParams, VoiceQueryMatch | null> {
  constructor(
    private readonly catalog: ShowCatalogRepository,
    private readonly feeds: PodcastFeedRepository,
  ) {}

  async execute(params: VoiceQueryParams): Promise<Result<VoiceQueryMatch | null>> {
    const catalogResult = await this.catalog.getShows();
    if (!catalogResult.ok) {
      return catalogResult;
    }
    const shows = catalogResult.value;
    if (shows.length === 0) {
      return ok(null);
    }

    const needle = stripCommands(normalize(params.query));

    // 1) Şov adı eşleşmesi → o şovun en son bölümü.
    const show = needle
      ? shows.find(s => matches(s.title, needle)) ?? shows.find(s => matches(s.author, needle))
      : undefined;

    if (show) {
      const latest = await this.latestEpisodeOf(show);
      return ok(latest ? { episode: latest, show, kind: 'showLatest' } : null);
    }

    // 2) Bölüm başlığı eşleşmesi — katalogdaki şovlar taranır.
    if (needle) {
      for (const candidate of shows) {
        const episodes = await this.episodesOf(candidate);
        const episode = episodes.find(e => matches(e.title, needle));
        if (episode) {
          return ok({ episode, show: candidate, kind: 'episode' });
        }
      }
    }

    // 3) Sorgu yoksa ya da hiçbir şey eşleşmediyse: ilk şovun son bölümü.
    const fallbackShow = shows[0];
    const fallback = await this.latestEpisodeOf(fallbackShow);
    return ok(fallback ? { episode: fallback, show: fallbackShow, kind: 'showLatest' } : null);
  }

  private async latestEpisodeOf(show: Show): Promise<Episode | undefined> {
    const episodes = await this.episodesOf(show);
    return episodes[0];
  }

  /** Şovun bölümlerini getirir; hata durumunda boş liste (arama sürsün). */
  private async episodesOf(show: Show): Promise<readonly Episode[]> {
    const result = await this.feeds.getFeed(show.feedUrl);
    return result.ok ? result.value.episodes : [];
  }
}
