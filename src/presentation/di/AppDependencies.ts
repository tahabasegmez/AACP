import {
  Analytics,
  ErrorReporter,
  ImagePalette,
  ImagePicker,
  RoutePicker,
} from '@core/ports';
import { SyncStatus } from '@domain/entities';
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
  GetAllProgress,
  GetLatestEpisodes,
  GetPlaybackProgress,
  GetPlaylists,
  GetPodcastFeed,
  GetPreferences,
  GetResumeList,
  GetSavedEpisodes,
  GetShowCatalog,
  GetShowEpisodes,
  IsFollowed,
  PausePlayback,
  PlayEpisode,
  RemoveDownload,
  RemoveEpisodeFromPlaylist,
  ResolveVoiceQuery,
  ResumePlayback,
  SavePlaybackProgress,
  SeekTo,
  SetEpisodeCompleted,
  SetPlaybackRate,
  SetPreference,
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

  /**
   * Sesli sorguyu çalınabilir bir bölüme çevirir (Siri / CarPlay sesli komut).
   * UI'da doğrudan kullanılmaz ama bağımlılık grafiği CarPlay ile paylaşıldığı
   * için burada da yer alır.
   */
  readonly resolveVoiceQuery: ResolveVoiceQuery;

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
  /** Tüm kayıtlar (tamamlananlar dahil) — listelerdeki "dinlendi" işareti. */
  readonly getAllProgress: GetAllProgress;
  /** Elle "dinlendi" işaretleme / işareti kaldırma. */
  readonly setEpisodeCompleted: SetEpisodeCompleted;

  // Kullanıcı tercihleri — misafirde cihazda, hesapta senkron
  readonly getPreferences: GetPreferences;
  readonly setPreference: SetPreference;

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
 * SyncService — presentation'ın senkrondan ihtiyaç duyduğu yüzey.
 * (Somut `SyncEngine`'e bağımlılık kurmamak için dar tutulur.)
 */
export interface SyncService {
  readonly enabled: boolean;

  /** Tüm koleksiyonları senkronlar ve sonuç durumunu döner. */
  syncAll(): Promise<SyncStatus>;

  /** Anlık durum (son senkron, bekleyen, hata). */
  getStatus(): SyncStatus;
  /** Durum değişikliklerine abone olur; iptal fonksiyonu döner. */
  subscribe(listener: (status: SyncStatus) => void): () => void;
  /** Gönderilmeyi bekleyen yerel değişiklik sayısı (ağa çıkmaz). */
  countPending(): Promise<number>;

  // --- kimlik değişimi ---------------------------------------------------
  /** Cihazdaki veriyi yeni hesaba taşıyarak senkronlar. */
  adoptLocalInto(): Promise<SyncStatus>;
  /** Cihazdaki veriyi atıp hesabın verisini indirir. */
  replaceWithRemote(): Promise<SyncStatus>;
  /** Yerel senkron verisini siler (çıkış akışı). İndirmelere dokunmaz. */
  clearLocalData(): Promise<void>;
}
