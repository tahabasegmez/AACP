import { FeedCatalogEntry } from '@core/config';
import { Show } from '@domain/entities';

/**
 * Katalog girişini (liste meta verisi — bundled ya da remote) domain Show'una çevirir.
 * Hem statik (bundled) hem uzak (remote) katalog aynı dönüşümü kullansın diye ortak.
 */
export const catalogEntryToShow = (entry: FeedCatalogEntry): Show => ({
  id: entry.slug,
  title: entry.title,
  description: entry.description ?? '',
  author: 'Anadolu Ajansı',
  imageUrl: entry.imageUrl,
  feedUrl: entry.feedUrl,
  language: 'tr',
  categories: [],
});
