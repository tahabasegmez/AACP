import {
  Analytics,
  ErrorReporter,
  ImagePalette,
  ImagePicker,
  RoutePicker,
} from '@core/ports';
import { UserRepository } from '@domain/repositories';
import { AudioPlayerService } from '@domain/services';
import {
  AddEpisodeToPlaylist,
  ContinueEpisode,
  CreatePlaylist,
  DeletePlaylist,
  DownloadEpisode,
  GetDownloads,
  GetFollowedShows,
  GetLatestEpisodes,
  GetPlaybackProgress,
  GetPlaylists,
  GetPodcastFeed,
  GetResumeList,
  GetSavedEpisodes,
  GetShowCatalog,
  GetShowEpisodes,
  IsFollowed,
  PausePlayback,
  PlayEpisode,
  RemoveDownload,
  RemoveEpisodeFromPlaylist,
  ResumePlayback,
  SavePlaybackProgress,
  SeekTo,
  SetPlaybackRate,
  SkipBy,
  StopPlayback,
  ToggleFollow,
  ToggleSavedEpisode,
  UpdatePlaylist,
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

  // İndirmeler (offline)
  readonly downloadEpisode: DownloadEpisode;
  readonly removeDownload: RemoveDownload;
  readonly getDownloads: GetDownloads;

  // Sonra dinle
  readonly toggleSavedEpisode: ToggleSavedEpisode;
  readonly getSavedEpisodes: GetSavedEpisodes;

  // Kullanıcı listeleri (playlist) — "Sonra dinle" de bir sistem listesidir
  readonly getPlaylists: GetPlaylists;
  readonly createPlaylist: CreatePlaylist;
  readonly updatePlaylist: UpdatePlaylist;
  readonly deletePlaylist: DeletePlaylist;
  readonly addEpisodeToPlaylist: AddEpisodeToPlaylist;
  readonly removeEpisodeFromPlaylist: RemoveEpisodeFromPlaylist;

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

  // Kapak görselinden baskın renk (arka plan renklendirme)
  readonly imagePalette: ImagePalette;
  /** Cihazdan görsel seçme (playlist kapağı). Kullanılamıyorsa özellik pasifleşir. */
  readonly imagePicker: ImagePicker;

  /** Kullanıcı kimliği ve profili (anonim ya da hesaplı). */
  readonly userRepository: UserRepository;

  /** Ses çıkış cihazı (AirPlay) seçici. Kullanılamıyorsa düğme pasifleşir. */
  readonly routePicker: RoutePicker;

  // Telemetri — sunucu yapılandırılmamışsa no-op adaptörlerdir (çağıran bilmez).
  readonly analytics: Analytics;
  readonly errorReporter: ErrorReporter;

  /**
   * Cihazlar arası senkron. Sunucu/ayar kapalıysa `undefined` olur; UI bunu
   * "senkron yok" olarak yorumlar ve tamamen yerel çalışır.
   */
  readonly sync?: SyncService;
}

/**
 * SyncService — presentation'ın senkrondan ihtiyaç duyduğu asgari yüzey.
 * (Somut `SyncEngine`'e bağımlılık kurmamak için dar bir arayüz.)
 */
export interface SyncService {
  readonly enabled: boolean;
  syncAll(): Promise<void>;
}
