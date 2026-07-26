import { PodcastFeed } from '@domain/entities';
import { mapRssFeedToPodcastFeed } from '../../mappers';
import { FeedSource } from './FeedSource';
import { RssFeedDataSource } from './RssFeedDataSource';

/**
 * RssFeedSource — FeedSource'un RSS implementasyonu (varsayılan kaynak).
 *
 * Ham RSS DTO'sunu çeker ve domain'e map eder. Böylece repository, verinin
 * RSS'ten mi API'den mi geldiğini bilmez.
 */
export class RssFeedSource implements FeedSource {
  constructor(private readonly rss: RssFeedDataSource) {}

  async fetchFeed(feedUrl: string): Promise<PodcastFeed> {
    const dto = await this.rss.fetch(feedUrl);
    return mapRssFeedToPodcastFeed(dto, feedUrl);
  }
}
