import { AudioPlayerService } from '@domain/services';
import { GetPodcastFeed, GetShowCatalog, PlayEpisode } from '@domain/usecases';

/**
 * CarPlayDependencies — CarPlay yüzeyinin ihtiyaç duyduğu use case ve servisler.
 *
 * CarPlay, mobil UI'dan (presentation) bağımsızdır ama AYNI domain use case'lerini
 * kullanır. Somut örnekler `app/di` içinde oluşturulup CarPlayController'a verilir.
 */
export interface CarPlayDependencies {
  readonly getShowCatalog: GetShowCatalog;
  readonly getPodcastFeed: GetPodcastFeed;
  readonly playEpisode: PlayEpisode;
  readonly audioPlayer: AudioPlayerService;
}
