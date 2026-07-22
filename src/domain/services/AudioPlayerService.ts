import { Episode, PlaybackState } from '../entities';

/**
 * AudioPlayerService — ses oynatma PORT'u (domain servis arayüzü).
 *
 * Somut implementasyon `infrastructure/audio` içinde react-native-track-player
 * ile yazılır. presentation ve carplay bu arayüzü kullanır; böylece hem mobil
 * UI hem CarPlay aynı oynatma mantığını paylaşır, kütüphaneyi tanımaz.
 */
export interface AudioPlayerService {
  /** Player'ı bir kez hazırlar (uygulama açılışında). */
  setup(): Promise<void>;

  /** Verilen bölümü yükler ve çalmaya başlar. */
  play(episode: Episode): Promise<void>;

  resume(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;

  /** Belirtilen saniyeye atlar. */
  seekTo(positionSec: number): Promise<void>;

  /** Oynatma hızını ayarlar (ör. 1.0, 1.5). */
  setRate(rate: number): Promise<void>;

  /** Anlık durumu döner. */
  getState(): Promise<PlaybackState>;

  /** Durum değişikliklerine abone olur; aboneliği iptal eden fonksiyon döner. */
  subscribe(listener: (state: PlaybackState) => void): () => void;
}
