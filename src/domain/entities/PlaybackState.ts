/**
 * Oynatma durumu — audio player'ın domain seviyesindeki temsili.
 * Somut player kütüphanesinden (track-player) bağımsızdır.
 */
export type PlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'buffering'
  | 'ended'
  | 'error';

/**
 * O an çalan REKLAM hakkında bilgi.
 *
 * `PlaybackState.ad` dolu olduğunda çalan şey bölüm değil reklamdır. Üst
 * katmanlar buna bakarak davranışını değiştirir:
 *  - UI reklam göstergesi çıkarır ve seek/hız kontrollerini kilitler,
 *  - "kaldığın yer" kaydı YAPILMAZ (reklam ilerlemesi bölüm ilerlemesi değildir).
 *
 * `currentEpisodeId` bu sırada da ASIL bölümü gösterir; böylece reklam bitince
 * hangi bölümde olduğumuz bilgisi kaybolmaz.
 */
export interface AdPlaybackState {
  readonly adId: string;
  readonly title?: string;
  readonly advertiser?: string;
  /** Tıklanınca açılacak adres (varsa). */
  readonly clickUrl?: string;
  /** Kesintideki kaçıncı reklam (1 tabanlı) — "Reklam 1/2" göstergesi için. */
  readonly index: number;
  /** Kesintideki toplam reklam sayısı. */
  readonly total: number;
  /** Kullanıcı bu reklamı atlayabilir mi (bugünkü politika: hayır). */
  readonly skippable: boolean;
}

export interface PlaybackState {
  readonly status: PlaybackStatus;
  /** O an çalan bölümün id'si, yoksa null. Reklam sırasında da korunur. */
  readonly currentEpisodeId: string | null;
  /** Geçerli konum (saniye). Reklam çalarken reklamın konumudur. */
  readonly positionSec: number;
  /** Toplam süre (saniye). Reklam çalarken reklamın süresidir. */
  readonly durationSec: number;
  /** Oynatma hızı (1.0 = normal). */
  readonly rate: number;
  /** Dolu ise çalan şey bir reklamdır (bkz. AdPlaybackState). */
  readonly ad?: AdPlaybackState;
}

export const INITIAL_PLAYBACK_STATE: PlaybackState = {
  status: 'idle',
  currentEpisodeId: null,
  positionSec: 0,
  durationSec: 0,
  rate: 1,
};

/** Şu anda reklam mı çalıyor? (Tek yerde tanımlı yardımcı.) */
export const isPlayingAd = (state: PlaybackState): boolean => state.ad != null;
