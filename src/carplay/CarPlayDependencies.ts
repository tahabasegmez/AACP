import { AudioPlayerService } from '@domain/services';
import {
  ContinueEpisode,
  GetPodcastFeed,
  GetResumeList,
  GetShowCatalog,
  PausePlayback,
  PlayEpisode,
  ResumePlayback,
} from '@domain/usecases';

/**
 * CarPlayDependencies — CarPlay yüzeyinin ihtiyaç duyduğu use case ve servisler.
 *
 * CarPlay, mobil UI'dan (presentation) bağımsızdır ama AYNI domain use case'lerini
 * kullanır. Somut örnekler `app/di` içinde oluşturulup CarPlayController'a verilir.
 * CarPlay'de sürücü güvenliği için sade bir set: şov/bölüm listeleme, çal,
 * kaldığın yerden devam et ve temel duraklat/sürdür.
 */
export interface CarPlayDependencies {
  readonly getShowCatalog: GetShowCatalog;
  readonly getPodcastFeed: GetPodcastFeed;
  readonly getResumeList: GetResumeList;
  readonly playEpisode: PlayEpisode;
  readonly continueEpisode: ContinueEpisode;
  readonly pausePlayback: PausePlayback;
  readonly resumePlayback: ResumePlayback;
  readonly audioPlayer: AudioPlayerService;
}
