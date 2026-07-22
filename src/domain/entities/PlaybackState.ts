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

export interface PlaybackState {
  readonly status: PlaybackStatus;
  /** O an çalan bölümün id'si, yoksa null. */
  readonly currentEpisodeId: string | null;
  /** Geçerli konum (saniye). */
  readonly positionSec: number;
  /** Toplam süre (saniye). */
  readonly durationSec: number;
  /** Oynatma hızı (1.0 = normal). */
  readonly rate: number;
}

export const INITIAL_PLAYBACK_STATE: PlaybackState = {
  status: 'idle',
  currentEpisodeId: null,
  positionSec: 0,
  durationSec: 0,
  rate: 1,
};
