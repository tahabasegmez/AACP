/**
 * PlaybackProgress — bir bölümün "kaldığın yer" bilgisi.
 *
 * Kullanıcı bir bölümü yarıda bıraktığında konumu kaydedilir; tekrar açtığında
 * o saniyeden devam eder. "Kaldığın yerden devam et" ve "Dinlemeye devam" (son
 * bırakılanlar) listeleri bu veriden beslenir.
 *
 * Görsel/oynatma alanları (episodeTitle, artworkUrl, audioUrl, showId) opsiyoneldir:
 * "Dinlemeye devam" kartı bunlarla başlık/kapak gösterir ve feed'i yeniden
 * çekmeden doğrudan oynatabilir.
 */
export interface PlaybackProgress {
  readonly episodeId: string;
  /** En son bulunulan konum (saniye). */
  readonly positionSec: number;
  /** Bölümün toplam süresi (saniye); ilerleme yüzdesi için. */
  readonly durationSec: number;
  /** Son güncelleme zamanı (ISO 8601) — "en son dinlenen" sıralaması için. */
  readonly updatedAt: string;
  /** Bölüm (neredeyse) sonuna gelindi mi? Bittiyse listede gösterilmez/işaretlenir. */
  readonly completed: boolean;

  // Gösterim/oynatma için opsiyonel meta (kaydederken doldurulur):
  readonly episodeTitle?: string;
  readonly showId?: string;
  readonly artworkUrl?: string;
  readonly audioUrl?: string;
}

/** Bir PlaybackProgress'in gösterim/oynatma meta verisi. */
export interface PlaybackProgressInfo {
  readonly episodeTitle?: string;
  readonly showId?: string;
  readonly artworkUrl?: string;
  readonly audioUrl?: string;
}

/** Bölüm bu orandan fazlası dinlendiyse "tamamlandı" sayılır. */
export const COMPLETION_THRESHOLD = 0.95;

/**
 * Konum + süreden bir PlaybackProgress üretir; tamamlanma durumunu hesaplar.
 * (Saf yardımcı — entity oluşturmayı tek yerde tutar.)
 */
export const buildPlaybackProgress = (
  episodeId: string,
  positionSec: number,
  durationSec: number,
  now: Date = new Date(),
  info?: PlaybackProgressInfo,
): PlaybackProgress => {
  const safePosition = Math.max(0, positionSec);
  const completed =
    durationSec > 0 && safePosition / durationSec >= COMPLETION_THRESHOLD;
  return {
    episodeId,
    positionSec: safePosition,
    durationSec,
    updatedAt: now.toISOString(),
    completed,
    episodeTitle: info?.episodeTitle,
    showId: info?.showId,
    artworkUrl: info?.artworkUrl,
    audioUrl: info?.audioUrl,
  };
};
