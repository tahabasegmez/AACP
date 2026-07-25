import { parseItunesDuration } from '@core/utils';
import { Episode, PodcastFeed, Show } from '@domain/entities';
import {
  RssCategoryNode,
  RssChannelDto,
  RssFeedDto,
  RssItemDto,
  RssTextNode,
} from '../dto';

/**
 * RSS DTO → domain PodcastFeed dönüşümü.
 *
 * RSS'in tüm düzensizlikleri (opsiyonel alanlar, tekil/dizi karışıklığı, iTunes
 * vs standart alan çakışması, attribute'lu metin düğümleri) burada normalize
 * edilir. Domain katmanı yalnızca temiz veri görür. Gerçek AA feed'i üzerinde
 * doğrulanmıştır.
 */

/** Feed URL'inden kararlı bir şov id'i (slug) üretir. */
export const slugFromFeedUrl = (feedUrl: string): string => {
  const cleaned = feedUrl.split('?')[0].replace(/\/+$/, '');
  const last = cleaned.substring(cleaned.lastIndexOf('/') + 1);
  return last || feedUrl;
};

const asArray = <T>(value: T | T[] | undefined): T[] => {
  if (value == null) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

/** Herhangi bir değeri güvenle trimlenmiş string'e çevirir (number/boolean dahil). */
const str = (value: unknown): string => {
  if (value == null) {
    return '';
  }
  return String(value).trim();
};

/** String ya da {#text} düğümünden düz metin çıkarır. */
const readText = (value: RssTextNode | undefined): string => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return str(value['#text']);
};

/** RSS pubDate'i güvenle ISO 8601'e çevirir; geçersizse boş string. */
const toIso = (pubDate?: string): string => {
  if (!pubDate) {
    return '';
  }
  const date = new Date(pubDate);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
};

/** İç içe olabilen itunes:category düğümlerini düz metin listesine indirger. */
const flattenCategories = (
  node: RssCategoryNode | RssCategoryNode[] | undefined,
): string[] => {
  const out: string[] = [];
  for (const cat of asArray(node)) {
    if (cat?.text) {
      out.push(cat.text);
    }
    if (cat?.['itunes:category']) {
      out.push(...flattenCategories(cat['itunes:category']));
    }
  }
  return out;
};

const numberOrUndefined = (value: unknown): number | undefined => {
  if (value == null || value === '') {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const mapShow = (channel: RssChannelDto, feedUrl: string, id: string): Show => ({
  id,
  title: str(channel.title) || 'İsimsiz Şov',
  description: str(channel.description) || str(channel['itunes:summary']),
  author: str(channel['itunes:author']),
  // itunes:image (href) tercih edilir; yoksa RSS <image><url>.
  imageUrl: channel['itunes:image']?.href ?? channel.image?.url,
  feedUrl,
  language: channel.language,
  categories: flattenCategories(channel['itunes:category']),
  websiteUrl: channel.link,
});

const mapEpisode = (
  item: RssItemDto,
  showId: string,
  showImageUrl?: string,
): Episode | null => {
  const audioUrl = item.enclosure?.url;
  if (!audioUrl) {
    return null; // ses dosyası (enclosure) olmayan item atlanır
  }
  return {
    id: readText(item.guid) || audioUrl,
    showId,
    title: str(item.title) || 'İsimsiz Bölüm',
    description:
      str(item.description) ||
      str(item['content:encoded']) ||
      str(item['itunes:summary']),
    audioUrl,
    mimeType: item.enclosure?.type,
    durationSec: parseItunesDuration(item['itunes:duration']),
    publishedAt: toIso(item.pubDate),
    // Bölümün kendi kapağı yoksa şovun kapağına düş.
    imageUrl: item['itunes:image']?.href ?? showImageUrl,
    episodeNumber: numberOrUndefined(item['itunes:episode']),
    season: numberOrUndefined(item['itunes:season']),
    fileSizeBytes: numberOrUndefined(item.enclosure?.length),
  };
};

/**
 * Bölüm id'lerinin benzersizliğini garanti eder.
 *
 * Bazı feed'lerde guid'ler tekrarlanabilir (ya da hiç olmayıp audioUrl'e düşer).
 * Çakışan id'ler React liste anahtarlarını ve "kaldığın yer" kaydını bozardı;
 * bu yüzden tekrar edeni "#2, #3 ..." ekiyle benzersizleştiririz (ilk giriş
 * olduğu gibi kalır).
 */
const ensureUniqueIds = (episodes: readonly Episode[]): Episode[] => {
  const seen = new Map<string, number>();
  return episodes.map(ep => {
    const count = seen.get(ep.id) ?? 0;
    seen.set(ep.id, count + 1);
    return count === 0 ? ep : { ...ep, id: `${ep.id}#${count + 1}` };
  });
};

export const mapRssFeedToPodcastFeed = (
  dto: RssFeedDto,
  feedUrl: string,
): PodcastFeed => {
  const channel = dto.channel ?? {};
  const id = slugFromFeedUrl(feedUrl);
  const show = mapShow(channel, feedUrl, id);
  const mapped = asArray(channel.item)
    .map(item => mapEpisode(item, id, show.imageUrl))
    .filter((e): e is Episode => e !== null);
  return { show, episodes: ensureUniqueIds(mapped) };
};
