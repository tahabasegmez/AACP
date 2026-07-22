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

/** String ya da {#text} düğümünden düz metin çıkarır. */
const readText = (value: RssTextNode | undefined): string => {
  if (value == null) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  return String(value['#text'] ?? '').trim();
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
  title: (channel.title ?? '').trim() || 'İsimsiz Şov',
  description: (channel.description ?? channel['itunes:summary'] ?? '').trim(),
  author: (channel['itunes:author'] ?? '').trim(),
  // itunes:image (href) tercih edilir; yoksa RSS <image><url>.
  imageUrl: channel['itunes:image']?.href ?? channel.image?.url,
  feedUrl,
  language: channel.language,
  categories: flattenCategories(channel['itunes:category']),
  websiteUrl: channel.link,
});

const mapEpisode = (item: RssItemDto, showId: string): Episode | null => {
  const audioUrl = item.enclosure?.url;
  if (!audioUrl) {
    return null; // ses dosyası (enclosure) olmayan item atlanır
  }
  return {
    id: readText(item.guid) || audioUrl,
    showId,
    title: (item.title ?? '').trim() || 'İsimsiz Bölüm',
    description: (
      item.description ??
      item['content:encoded'] ??
      item['itunes:summary'] ??
      ''
    ).trim(),
    audioUrl,
    mimeType: item.enclosure?.type,
    durationSec: parseItunesDuration(item['itunes:duration']),
    publishedAt: toIso(item.pubDate),
    imageUrl: item['itunes:image']?.href,
    episodeNumber: numberOrUndefined(item['itunes:episode']),
    season: numberOrUndefined(item['itunes:season']),
    fileSizeBytes: numberOrUndefined(item.enclosure?.length),
  };
};

export const mapRssFeedToPodcastFeed = (
  dto: RssFeedDto,
  feedUrl: string,
): PodcastFeed => {
  const channel = dto.channel ?? {};
  const id = slugFromFeedUrl(feedUrl);
  const show = mapShow(channel, feedUrl, id);
  const episodes = asArray(channel.item)
    .map(item => mapEpisode(item, id))
    .filter((e): e is Episode => e !== null);
  return { show, episodes };
};
