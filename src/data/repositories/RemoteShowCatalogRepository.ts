import { FeedCatalogEntry } from '@core/config';
import { AppError, Result, fail, ok } from '@core/error';
import { Logger } from '@core/logger';
import { KeyValueStorage } from '@core/ports';
import { Show } from '@domain/entities';
import { ShowCatalogRepository } from '@domain/repositories';
import { RemoteCatalogDataSource } from '../datasources';
import { catalogEntryToShow } from '../mappers';

/** Katalog önbelleğinin storage anahtarı. */
const CACHE_KEY = 'remote_catalog_v1';

interface CachedCatalog {
  readonly fetchedAt: number;
  readonly entries: readonly FeedCatalogEntry[];
}

export interface RemoteCatalogConfig {
  /** Katalog ucunun adresi. */
  readonly remoteUrl: string;
  /** Önbellek geçerlilik süresi (ms). */
  readonly ttlMs: number;
}

/**
 * RemoteShowCatalogRepository — şov kataloğu SUNUCUDAN gelir.
 *
 * Öncelik sırası:
 *   1) TTL içinde önbellek varsa onu kullan (ağa çıkma),
 *   2) yoksa sunucudan çek, önbelleğe al ve kullan (yetkili kaynak),
 *   3) çekim başarısızsa bayat önbelleği kullan.
 *
 * Böylece yeni şov = veritabanına bir satır; uygulama güncellemesi GEREKMEZ.
 *
 * **Uygulamaya gömülü bir yedek liste yoktur.** İlk açılışta ağ yoksa katalog
 * boş gelir; sonraki açılışlarda önbellek devreye girer ve çevrimdışı çalışır.
 * Gömülü listeyi taşımak, kataloğu iki yerde tutmak ve ikisinin sessizce
 * ayrışması demekti — tek kaynak sunucudur.
 *
 * Boş bir uzak liste hatalı deploy sayılır ve önbelleğe yazılmaz (tüm şovları
 * yanlışlıkla gizlememek için).
 */
export class RemoteShowCatalogRepository implements ShowCatalogRepository {
  constructor(
    private readonly remote: RemoteCatalogDataSource,
    private readonly storage: KeyValueStorage,
    private readonly logger: Logger,
    private readonly config: RemoteCatalogConfig,
  ) {}

  async getShows(): Promise<Result<readonly Show[]>> {
    const entries = await this.resolveCatalog();
    return ok(entries.map(catalogEntryToShow));
  }

  async getShowById(id: string): Promise<Result<Show>> {
    const entries = await this.resolveCatalog();
    const entry = entries.find(e => e.slug === id);
    return entry
      ? ok(catalogEntryToShow(entry))
      : fail(AppError.notFound(`Şov bulunamadı: ${id}`));
  }

  /** Etkin katalogu (önbellek/uzak) çözer. */
  private async resolveCatalog(): Promise<readonly FeedCatalogEntry[]> {
    const cached = this.readCache();
    if (cached && this.isFresh(cached)) {
      return cached.entries;
    }

    try {
      const entries = await this.remote.fetch(this.config.remoteUrl);
      if (entries.length === 0) {
        throw AppError.parse('Uzak katalog boş döndü');
      }
      this.writeCache(entries);
      return entries;
    } catch (error) {
      this.logger.warn('Katalog alınamadı; önbellek kullanılıyor', error);
      return cached?.entries ?? [];
    }
  }

  private isFresh(cached: CachedCatalog): boolean {
    return Date.now() - cached.fetchedAt < this.config.ttlMs;
  }

  private readCache(): CachedCatalog | null {
    const raw = this.storage.getString(CACHE_KEY);
    if (!raw) {
      return null;
    }
    try {
      const parsed = JSON.parse(raw) as CachedCatalog;
      return Array.isArray(parsed?.entries) ? parsed : null;
    } catch {
      return null;
    }
  }

  private writeCache(entries: readonly FeedCatalogEntry[]): void {
    const payload: CachedCatalog = { fetchedAt: Date.now(), entries };
    this.storage.set(CACHE_KEY, JSON.stringify(payload));
  }
}
