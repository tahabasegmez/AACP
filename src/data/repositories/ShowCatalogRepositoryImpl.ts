import { FeedCatalogEntry } from '@core/config';
import { AppError, Result, fail, ok } from '@core/error';
import { Show } from '@domain/entities';
import { ShowCatalogRepository } from '@domain/repositories';

/**
 * ShowCatalogRepository'nin somut implementasyonu.
 *
 * Şov listesini curated feed kataloğundan (core/config) üretir — **ağ isteği
 * YAPMAZ**. Böylece şov listesi anında gelir (11 adet büyük feed'i sırf liste
 * için indirmekten kaçınırız). Bir şovun zengin/güncel meta verisi ve bölümleri,
 * o şova girildiğinde PodcastFeedRepository ile ayrıca çekilir.
 *
 * İleride sunucu tarafı bir "tüm şovlar" endpoint'i gelirse yalnızca bu sınıf
 * değişir; arayüz (ShowCatalogRepository) ve çağıran kod aynı kalır.
 */
export class ShowCatalogRepositoryImpl implements ShowCatalogRepository {
  constructor(private readonly catalog: readonly FeedCatalogEntry[]) {}

  async getShows(): Promise<Result<readonly Show[]>> {
    return ok(this.catalog.map(toShow));
  }

  async getShowById(id: string): Promise<Result<Show>> {
    const entry = this.catalog.find(e => e.slug === id);
    return entry
      ? ok(toShow(entry))
      : fail(AppError.notFound(`Şov bulunamadı: ${id}`));
  }
}

/** Katalog girişini (liste meta verisi) domain Show'una çevirir. */
const toShow = (entry: FeedCatalogEntry): Show => ({
  id: entry.slug,
  title: entry.title,
  description: entry.description ?? '',
  author: 'Anadolu Ajansı',
  imageUrl: entry.imageUrl,
  feedUrl: entry.feedUrl,
  language: 'tr',
  categories: [],
});
