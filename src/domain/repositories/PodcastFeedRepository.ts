import { Result } from '@core/error';
import { PodcastFeed } from '../entities';

/**
 * PodcastFeedRepository — bir şovun RSS feed'ini (şov + bölümler) sağlar.
 *
 * PORT (arayüz). Implementasyon `data` katmanında; RSS çekme + parse + cache
 * ayrıntıları orada saklanır.
 */
export interface PodcastFeedRepository {
  /**
   * Verilen feed URL'inden şov meta verisini ve bölüm listesini çözer.
   * @param feedUrl Şovun RSS feed adresi.
   */
  getFeed(feedUrl: string): Promise<Result<PodcastFeed>>;
}
