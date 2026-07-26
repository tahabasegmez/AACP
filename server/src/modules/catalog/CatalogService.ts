import fs from 'node:fs';
import path from 'node:path';
import { HttpError } from '../../core/errors';
import type { Store } from '../../storage/Store';

/** Uygulamanın beklediği katalog girdisi (mobil `FeedCatalogEntry` ile birebir). */
export interface CatalogEntry {
  readonly slug: string;
  readonly feedUrl: string;
  readonly title: string;
  readonly imageUrl?: string;
  readonly description?: string;
}

/**
 * CatalogService — şov kataloğunu (shows.json) yayınlar ve yönetir.
 *
 * Öncelik: veritabanındaki yayınlanmış katalog → `DATA_DIR/shows.json` dosyası
 * → boş. Böylece katalog hem yönetim ucundan (POST) hem de dosyayı sunucuya
 * kopyalayarak güncellenebilir; ikisi de aynı çıktıyı verir.
 *
 * İstemci tarafı zaten bundled bir fallback taşıdığı için sunucu erişilemese
 * bile uygulama çalışır.
 */
export class CatalogService {
  constructor(
    private readonly store: Store,
    private readonly dataDir: string,
  ) {}

  /** Yayınlanacak katalog (JSON metni). */
  async get(): Promise<CatalogEntry[]> {
    const stored = await this.store.getCatalog();
    if (stored) {
      return parseCatalog(stored);
    }

    const filePath = path.join(this.dataDir, 'shows.json');
    if (fs.existsSync(filePath)) {
      return parseCatalog(fs.readFileSync(filePath, 'utf8'));
    }
    return [];
  }

  /** Kataloğu doğrulayıp kalıcı olarak yayınlar (yönetim ucu). */
  async publish(raw: unknown): Promise<{ count: number }> {
    const entries = normalizeCatalog(raw);
    if (entries.length === 0) {
      // Boş katalog yayınlamak tüm şovları gizlerdi — kazayla olmasın diye reddedilir.
      throw HttpError.badRequest('Katalog boş olamaz');
    }
    await this.store.setCatalog(JSON.stringify(entries));
    return { count: entries.length };
  }
}

const parseCatalog = (json: string): CatalogEntry[] => {
  try {
    return normalizeCatalog(JSON.parse(json));
  } catch {
    return [];
  }
};

const isNonEmpty = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0;

const optional = (v: unknown): string | undefined => (isNonEmpty(v) ? v.trim() : undefined);

/**
 * Ham veriyi doğrulanmış katalog girdilerine indirger.
 * Geçersiz girişler sessizce atlanır — tek bozuk kayıt tüm listeyi düşürmez.
 */
export const normalizeCatalog = (raw: unknown): CatalogEntry[] => {
  if (!Array.isArray(raw)) {
    throw HttpError.badRequest('Katalog bir dizi olmalı');
  }
  const seen = new Set<string>();
  const out: CatalogEntry[] = [];

  for (const item of raw) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }
    const o = item as Record<string, unknown>;
    if (!isNonEmpty(o.slug) || !isNonEmpty(o.feedUrl) || !isNonEmpty(o.title)) {
      continue;
    }
    const slug = o.slug.trim();
    if (seen.has(slug)) {
      continue; // yinelenen slug — ilk kayıt geçerli
    }
    seen.add(slug);
    out.push({
      slug,
      feedUrl: o.feedUrl.trim(),
      title: o.title.trim(),
      imageUrl: optional(o.imageUrl),
      description: optional(o.description),
    });
  }
  return out;
};
