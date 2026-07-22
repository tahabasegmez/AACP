import { PodcastFeed } from '@domain/entities';

/**
 * FeedCacheDataSource — çözülmüş feed'leri yerel olarak önbelleğe alır.
 *
 * Arayüz olarak tanımlı; ilk implementasyon bellek-içi (in-memory) olabilir,
 * ileride MMKV/disk'e taşınır. TanStack Query zaten runtime cache sağlar; bu
 * katman kalıcı (offline-first) cache içindir ve sonraki fazda genişletilecek.
 */
export interface FeedCacheDataSource {
  get(feedUrl: string): Promise<PodcastFeed | null>;
  set(feedUrl: string, feed: PodcastFeed): Promise<void>;
  clear(): Promise<void>;
}

/**
 * Basit bellek-içi, TTL'li implementasyon (ilk sürüm için yeterli).
 *
 * TTL önemli: süresiz cache, presentation'daki TanStack Query'nin yeniden
 * çekmesini etkisiz kılar ve eski bölümleri sonsuza dek gösterirdi. TTL dolunca
 * giriş "yok" sayılır ve feed yeniden çekilir.
 */
export class InMemoryFeedCacheDataSource implements FeedCacheDataSource {
  private readonly store = new Map<string, { feed: PodcastFeed; expiresAt: number }>();

  constructor(private readonly ttlMs: number) {}

  async get(feedUrl: string): Promise<PodcastFeed | null> {
    const entry = this.store.get(feedUrl);
    if (!entry) {
      return null;
    }
    if (Date.now() > entry.expiresAt) {
      this.store.delete(feedUrl);
      return null;
    }
    return entry.feed;
  }

  async set(feedUrl: string, feed: PodcastFeed): Promise<void> {
    this.store.set(feedUrl, { feed, expiresAt: Date.now() + this.ttlMs });
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}
