import { Episode, PodcastFeed, Show } from '@domain/entities';
import {
  TransistorEpisodeDto,
  TransistorShowDto,
} from '../dto';

/**
 * Transistor API DTO → domain dönüşümü.
 *
 * RSS mapper'ıyla AYNI domain şeklini üretir; böylece kaynak değişse de üst
 * katmanlar (repository, use case, UI) etkilenmez. Eksik/boş alanlar güvenli
 * varsayılanlara indirgenir — uzak veri asla doğrudan güvenilmez.
 */

const str = (value: unknown): string => (value == null ? '' : String(value).trim());

const numberOrUndefined = (value: unknown): number | undefined => {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/** Transistor tarihini ISO 8601'e çevirir; geçersizse boş string. */
const toIso = (value?: string): string => {
  if (!value) {
    return '';
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
};

/**
 * Şov kimliği: kararlı olması için önce slug, sonra feed URL'inden türetme,
 * en son API id'si. (Uygulamanın geri kalanı slug'ı kimlik kabul eder.)
 */
export const transistorShowId = (dto: TransistorShowDto, fallbackFeedUrl?: string): string => {
  const slug = str(dto.attributes?.slug);
  if (slug) {
    return slug;
  }
  const feed = str(dto.attributes?.feed_url) || str(fallbackFeedUrl);
  if (feed) {
    const cleaned = feed.split('?')[0].replace(/\/+$/, '');
    const last = cleaned.substring(cleaned.lastIndexOf('/') + 1);
    if (last) {
      return last;
    }
  }
  return str(dto.id);
};

export const mapTransistorShow = (
  dto: TransistorShowDto,
  fallbackFeedUrl = '',
): Show => {
  const a = dto.attributes ?? {};
  return {
    id: transistorShowId(dto, fallbackFeedUrl),
    title: str(a.title) || 'İsimsiz Şov',
    description: str(a.description),
    author: str(a.author),
    imageUrl: str(a.image_url) || undefined,
    feedUrl: str(a.feed_url) || fallbackFeedUrl,
    language: str(a.language) || undefined,
    categories: [],
    websiteUrl: str(a.website) || undefined,
  };
};

/** Yayınlanmamış (draft/scheduled) bölümler listelenmez. */
const isPublished = (dto: TransistorEpisodeDto): boolean => {
  const status = str(dto.attributes?.status).toLowerCase();
  return status === '' || status === 'published';
};

export const mapTransistorEpisode = (
  dto: TransistorEpisodeDto,
  showId: string,
  showImageUrl?: string,
): Episode | null => {
  const a = dto.attributes ?? {};
  const audioUrl = str(a.media_url) || str(a.audio_url);
  if (!audioUrl || !isPublished(dto)) {
    return null; // çalınamayan/yayınlanmamış bölüm atlanır
  }
  return {
    id: str(dto.id) || audioUrl,
    showId,
    title: str(a.title) || 'İsimsiz Bölüm',
    description: str(a.description) || str(a.formatted_summary) || str(a.summary),
    audioUrl,
    mimeType: 'audio/mpeg',
    durationSec: numberOrUndefined(a.duration) ?? 0,
    publishedAt: toIso(a.published_at),
    imageUrl: str(a.image_url) || showImageUrl,
    episodeNumber: numberOrUndefined(a.number),
    season: numberOrUndefined(a.season),
  };
};

/** Şov + bölüm listesini domain PodcastFeed'ine birleştirir (yeniden eskiye). */
export const mapTransistorFeed = (
  showDto: TransistorShowDto,
  episodeDtos: ReadonlyArray<TransistorEpisodeDto>,
  fallbackFeedUrl = '',
): PodcastFeed => {
  const show = mapTransistorShow(showDto, fallbackFeedUrl);
  const episodes = episodeDtos
    .map(e => mapTransistorEpisode(e, show.id, show.imageUrl))
    .filter((e): e is Episode => e !== null)
    .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  return { show, episodes };
};
