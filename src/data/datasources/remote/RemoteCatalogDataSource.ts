import { FeedCatalogEntry } from '@core/config';
import { AppError } from '@core/error';
import { HttpClient } from '@core/ports';

/**
 * RemoteCatalogDataSource — uzak sunucudan şov kataloğunu (JSON) çeker.
 *
 * Beklenen format: FeedCatalogEntry dizisi
 *   [{ "slug": "...", "feedUrl": "...", "title": "...", "imageUrl?": "...", "description?": "..." }, ...]
 *
 * Uzak veri güvenilmezdir: JSON dizi değilse hata verir; dizideki geçersiz
 * (slug/feedUrl/title'ı eksik) girişler sessizce atlanır ki tek bozuk kayıt tüm
 * listeyi düşürmesin. Böylece kısmi/hatalı remote veriye karşı dayanıklıyız.
 */
export class RemoteCatalogDataSource {
  constructor(private readonly http: HttpClient) {}

  async fetch(url: string): Promise<FeedCatalogEntry[]> {
    const text = await this.http.getText(url);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw AppError.parse('Uzak katalog JSON olarak ayrıştırılamadı', error);
    }

    if (!Array.isArray(parsed)) {
      throw AppError.parse('Uzak katalog bir dizi olmalı');
    }

    return parsed
      .map(toEntry)
      .filter((e): e is FeedCatalogEntry => e !== null);
  }
}

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const optionalString = (v: unknown): string | undefined =>
  isNonEmptyString(v) ? v : undefined;

/** Ham bir öğeyi doğrular ve FeedCatalogEntry'ye çevirir; geçersizse null. */
const toEntry = (raw: unknown): FeedCatalogEntry | null => {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  if (!isNonEmptyString(o.slug) || !isNonEmptyString(o.feedUrl) || !isNonEmptyString(o.title)) {
    return null;
  }
  return {
    slug: o.slug,
    feedUrl: o.feedUrl,
    title: o.title,
    imageUrl: optionalString(o.imageUrl),
    description: optionalString(o.description),
  };
};
