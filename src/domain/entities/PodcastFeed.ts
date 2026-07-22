import { Episode } from './Episode';
import { Show } from './Show';

/**
 * PodcastFeed — tek bir RSS feed'inin çözümlenmiş hali: şov meta verisi + bölümler.
 *
 * Bir RSS feed hem channel (şov) hem item'ları (bölümler) içerdiği için bunları
 * birlikte taşıyan bir birleşik nesne kullanıyoruz.
 */
export interface PodcastFeed {
  readonly show: Show;
  readonly episodes: readonly Episode[];
}
