import { AudioPlayerService } from '@domain/services';
import {
  ContinueEpisode,
  DownloadEpisode,
  GetDownloads,
  GetFollowedShows,
  GetLatestEpisodes,
  GetPlaybackProgress,
  GetPodcastFeed,
  GetPreferences,
  GetResumeList,
  GetShowCatalog,
  GetShowEpisodes,
  IsFollowed,
  PausePlayback,
  PlayEpisode,
  RemoveDownload,
  ResumePlayback,
  SavePlaybackProgress,
  SavePreferences,
  SeekTo,
  SetPlaybackRate,
  SkipBy,
  StopPlayback,
  ToggleFollow,
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
  readonly getLatestEpisodes: GetLatestEpisodes;

  // Takip (follow)
  readonly toggleFollow: ToggleFollow;
  readonly isFollowed: IsFollowed;
  readonly getFollowedShows: GetFollowedShows;

  // Tercihler
  readonly getPreferences: GetPreferences;
  readonly savePreferences: SavePreferences;

  // İndirmeler (offline)
  readonly downloadEpisode: DownloadEpisode;
  readonly removeDownload: RemoveDownload;
  readonly getDownloads: GetDownloads;

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
