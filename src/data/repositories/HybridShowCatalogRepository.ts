import { FeedCatalogEntry } from '@core/config';
import { AppError, Result, fail, ok } from '@core/error';
import { Logger } from '@core/logger';
import { KeyValueStorage } from '@core/ports';
import { Show } from '@domain/entities';
import { ShowCatalogRepository } from '@domain/repositories';
import { RemoteCatalogDataSource } from '../datasources';
import { catalogEntryToShow } from '../mappers';

/** Uzak katalog cache'inin storage anahtarı. */
const CACHE_KEY = 'remote_catalog_v1';

interface CachedCatalog {
  readonly fetchedAt: number;
  readonly entries: readonly FeedCatalogEntry[];
}

export interface HybridCatalogConfig {
  /** Uzak katalog JSON URL'i. Boş/undefined ise yalnızca bundled kullanılır. */
  readonly remoteUrl?: string;
  /** Uzak katalog cache geçerlilik süresi (ms). */
  readonly ttlMs: number;
}

/**
 * HybridShowCatalogRepository — HİBRİT şov kataloğu.
 *
 * Öncelik sırası:
 *   1) TTL içinde önbelleğe alınmış uzak katalog varsa onu kullan (ağa çıkma).
 *   2) Yoksa uzak katalogu çek; başarılıysa önbelleğe al ve kullan (yetkili kaynak).
 *   3) Uzak çekim başarısızsa: bayat önbellek varsa onu, yoksa BUNDLED katalogu kullan.
 *
 * Böylece:
 *   - Yeni şov = uzak JSON'a satır eklemek (app güncellemesi GEREKMEZ).
 *   - İlk açılış / çevrimdışı / sunucu çökük → uygulama yine çalışır (bundled).
 *   - remoteUrl verilmezse davranış birebir bundled-only'dir.
 *
 * Uzak katalog "yetkili"dir (tam liste); bundled yalnızca güvenlik ağıdır.
 * Boş bir uzak liste hatalı deploy sayılır ve fallback tetikler (tüm şovları
 * yanlışlıkla gizlememek için).
 */
export class HybridShowCatalogRepository implements ShowCatalogRepository {
  constructor(
    private readonly bundled: readonly FeedCatalogEntry[],
    private readonly remote: RemoteCatalogDataSource,
    private readonly storage: KeyValueStorage,
    private readonly logger: Logger,
    private readonly config: HybridCatalogConfig,
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

  /** Etkin katalogu (uzak/önbellek/bundled) çözer. */
  private async resolveCatalog(): Promise<readonly FeedCatalogEntry[]> {
    if (!this.config.remoteUrl) {
      return this.bundled;
    }

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
      this.logger.warn(
        'Uzak katalog alınamadı; fallback kullanılıyor',
        error,
      );
      return cached?.entries ?? this.bundled;
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
