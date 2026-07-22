/**
 * RSS parse çıktısının ham şekli (DTO — Data Transfer Object).
 *
 * Bu tipler `infrastructure/rss` parser'ının (fast-xml-parser, namespace'ler
 * KORUNARAK) ürettiği yapıyı temsil eder ve gerçek Anadolu Ajansı feed'i
 * üzerinde doğrulanmıştır. Alanlar opsiyonel/gevşektir çünkü RSS her zaman
 * tam/temiz değildir; normalizasyon `data/mappers` içinde yapılır.
 *
 * Namespace'li alanlara (itunes:*, podcast:*) köşeli parantezle erişilir.
 * `#text` fast-xml-parser'ın metin düğümü anahtarıdır (ör. attribute'lu guid).
 */

export interface RssEnclosureDto {
  url?: string;
  type?: string;
  length?: string | number;
}

/** Attribute'lu bir düğüm hem metin (#text) hem attribute taşıyabilir. */
export type RssTextNode = string | { '#text'?: string; [attr: string]: unknown };

/** itunes:image gibi yalnızca href attribute'u taşıyan düğüm. */
export interface RssHrefNode {
  href?: string;
}

/** RSS standardı <image><url>...</url></image> düğümü. */
export interface RssImageNode {
  url?: string;
  title?: string;
  link?: string;
}

export interface RssCategoryNode {
  text?: string;
  'itunes:category'?: RssCategoryNode | RssCategoryNode[];
}

export interface RssItemDto {
  guid?: RssTextNode;
  title?: string;
  description?: string;
  'content:encoded'?: string;
  'itunes:summary'?: string;
  pubDate?: string;
  'itunes:duration'?: string | number;
  'itunes:episode'?: string | number;
  'itunes:season'?: string | number;
  'itunes:image'?: RssHrefNode;
  enclosure?: RssEnclosureDto;
}

export interface RssChannelDto {
  title?: string;
  description?: string;
  'itunes:summary'?: string;
  'itunes:author'?: string;
  language?: string;
  link?: string;
  image?: RssImageNode;
  'itunes:image'?: RssHrefNode;
  'itunes:category'?: RssCategoryNode | RssCategoryNode[];
  item?: RssItemDto | RssItemDto[];
}

export interface RssFeedDto {
  channel?: RssChannelDto;
}
