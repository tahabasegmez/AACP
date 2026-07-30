import { ArtworkCache } from '@core/ports';
import { AudioPlayerService, PlaybackSessionService } from '@domain/services';
import {
  ContinueEpisode,
  GetDownloads,
  GetPlaylists,
  GetResumeList,
  GetShowCatalog,
  GetShowEpisodes,
  PausePlayback,
  PlayEpisode,
  ResolveVoiceQuery,
  ResumePlayback,
  SetPlaybackRate,
} from '@domain/usecases';

/**
 * CarPlayDependencies — CarPlay yüzeyinin ihtiyaç duyduğu use case ve servisler.
 *
 * CarPlay, mobil UI'dan (presentation) bağımsızdır ama AYNI domain use
 * case'lerini kullanır. Somut örnekler `app/di` içinde oluşturulup
 * CarPlayController'a verilir.
 *
 * Sürücü güvenliği gereği CarPlay'de sadeleştirilmiş bir küme sunulur:
 * kaldığın yerden devam, indirilenler (çevrimdışı), listeler, çal/duraklat,
 * hız ve sesle çalma.
 */
export interface CarPlayDependencies {
  // --- içerik kaynakları --------------------------------------------------
  readonly getShowCatalog: GetShowCatalog;
  readonly getShowEpisodes: GetShowEpisodes;
  /** Yarıda bırakılanlar — CarPlay'in ana giriş noktası. */
  readonly getResumeList: GetResumeList;
  /** Çevrimdışı çalınabilir bölümler; araçta şebeke koparsa da çalışır. */
  readonly getDownloads: GetDownloads;
  /** Kullanıcı listeleri ("Sonra dinle" sistem listesi dahil). */
  readonly getPlaylists: GetPlaylists;

  // --- oynatma ------------------------------------------------------------
  readonly playEpisode: PlayEpisode;
  readonly continueEpisode: ContinueEpisode;
  readonly pausePlayback: PausePlayback;
  readonly resumePlayback: ResumePlayback;
  readonly setPlaybackRate: SetPlaybackRate;
  readonly audioPlayer: AudioPlayerService;
  /**
   * Oynatma oturumu. CarPlay bir listeden çalmaya başladığında bağlamı KURAR
   * (kuyruk + çalan bölüm) ve "Sıradakiler" listesini buradan okur — kendi
   * kopyasını tutmaz. Telefondaki oynatma da aynı oturumu kullanır.
   */
  readonly playbackSession: PlaybackSessionService;

  // --- görseller ----------------------------------------------------------
  /**
   * Kapakları yerelleştirir. CarPlay uzak görsel kabul etmediği için ŞART:
   * satırlara `file://` adresi verilir.
   */
  readonly artwork: ArtworkCache;

  // --- sesli komut --------------------------------------------------------
  /** Sesli sorguyu çalınabilir bir bölüme çevirir (Siri / sesli arama). */
  readonly resolveVoiceQuery: ResolveVoiceQuery;
}
