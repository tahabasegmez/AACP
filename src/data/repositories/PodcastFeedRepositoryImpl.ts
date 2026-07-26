import { AppError, Result, fail, ok } from '@core/error';
import { Logger } from '@core/logger';
import { PodcastFeed } from '@domain/entities';
import { PodcastFeedRepository } from '@domain/repositories';
import { FeedCacheDataSource, FeedSource } from '../datasources';

/**
 * PodcastFeedRepository'nin somut implementasyonu.
 *
 * Akış: önce (kalıcı) cache'e bak → yoksa FeedSource'tan çek → cache'e yaz →
 * döndür. Hataları AppError/Result'a çevirir; bu katmanın üstü asla ham
 * exception görmez.
 *
 * Kaynak (RSS / Transistor API) bir STRATEJİdir: `FeedSource` arayüzü üzerinden
 * enjekte edilir, bu sınıf hangisi olduğunu bilmez.
 */
export class PodcastFeedRepositoryImpl implements PodcastFeedRepository {
  constructor(
    private readonly source: FeedSource,
    private readonly cache: FeedCacheDataSource,
    private readonly logger: Logger,
  ) {}

  async getFeed(feedUrl: string): Promise<Result<PodcastFeed>> {
    try {
      const cached = await this.cache.get(feedUrl);
      if (cached) {
        return ok(cached);
      }

      const feed = await this.source.fetchFeed(feedUrl);
      await this.cache.set(feedUrl, feed);
      return ok(feed);
    } catch (error) {
      this.logger.error('Feed çekilemedi', feedUrl, error);
      return fail(AppError.from(error, 'NETWORK'));
    }
  }
}
