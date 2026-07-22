import { AppError, Result, fail, ok } from '@core/error';
import { Logger } from '@core/logger';
import { PodcastFeed } from '@domain/entities';
import { PodcastFeedRepository } from '@domain/repositories';
import { FeedCacheDataSource, RssFeedDataSource } from '../datasources';
import { mapRssFeedToPodcastFeed } from '../mappers';

/**
 * PodcastFeedRepository'nin somut implementasyonu.
 *
 * Akış: önce (kalıcı) cache'e bak → yoksa RSS datasource'tan çek → DTO'yu
 * domain'e map et → cache'e yaz → döndür. Hataları AppError/Result'a çevirir;
 * bu katmanın üstü asla ham exception görmez.
 */
export class PodcastFeedRepositoryImpl implements PodcastFeedRepository {
  constructor(
    private readonly remote: RssFeedDataSource,
    private readonly cache: FeedCacheDataSource,
    private readonly logger: Logger,
  ) {}

  async getFeed(feedUrl: string): Promise<Result<PodcastFeed>> {
    try {
      const cached = await this.cache.get(feedUrl);
      if (cached) {
        return ok(cached);
      }

      const dto = await this.remote.fetch(feedUrl);
      const feed = mapRssFeedToPodcastFeed(dto, feedUrl);
      await this.cache.set(feedUrl, feed);
      return ok(feed);
    } catch (error) {
      this.logger.error('Feed çekilemedi', feedUrl, error);
      return fail(AppError.from(error, 'NETWORK'));
    }
  }
}
