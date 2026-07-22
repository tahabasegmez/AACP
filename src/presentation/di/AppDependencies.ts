import { AudioPlayerService } from '@domain/services';
import {
  ContinueEpisode,
  GetPlaybackProgress,
  GetPodcastFeed,
  GetResumeList,
  GetShowCatalog,
  GetShowEpisodes,
  PausePlayback,
  PlayEpisode,
  ResumePlayback,
  SavePlaybackProgress,
  SeekTo,
  SetPlaybackRate,
  SkipBy,
  StopPlayback,
} from '@domain/usecases';

/**
 * AppDependencies — UI'ın ihtiyaç duyduğu use case ve servislerin sözleşmesi.
 *
 * presentation, hangi somut sınıfların kullanıldığını BİLMEZ; yalnızca bu şekle
 * ihtiyaç duyar. Somut örnekler `app/di` içinde oluşturulup DependencyProvider
 * ile sağlanır (Dependency Inversion).
 *
 * Yeni bir ekran yeni bir use case gerektirdiğinde: use case'i buraya ekle,
 * app/di'da örneğini ver, `useDependencies()` ile ekranında kullan.
 */
export interface AppDependencies {
  // Kataloglar
  readonly getShowCatalog: GetShowCatalog;
  readonly getPodcastFeed: GetPodcastFeed;
  readonly getShowEpisodes: GetShowEpisodes;

  // Oynatıcı transport
  readonly playEpisode: PlayEpisode;
  readonly pausePlayback: PausePlayback;
  readonly resumePlayback: ResumePlayback;
  readonly stopPlayback: StopPlayback;
  readonly seekTo: SeekTo;
  readonly skipBy: SkipBy;
  readonly setPlaybackRate: SetPlaybackRate;

  // Son dinlenen konum (kaldığın yerden devam)
  readonly savePlaybackProgress: SavePlaybackProgress;
  readonly getPlaybackProgress: GetPlaybackProgress;
  readonly continueEpisode: ContinueEpisode;
  readonly getResumeList: GetResumeList;

  // Oynatıcı servisi (durum köprüsü için)
  readonly audioPlayer: AudioPlayerService;
}
