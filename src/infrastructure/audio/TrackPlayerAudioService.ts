import { INITIAL_PLAYBACK_STATE, PlaybackState } from '@domain/entities';
import { Episode } from '@domain/entities';
import { AudioPlayerService } from '@domain/services';

/**
 * TrackPlayerAudioService — AudioPlayerService portunun
 * react-native-track-player tabanlı implementasyonu.
 *
 * Bu sınıf, track-player'ın olaylarını dinleyip domain `PlaybackState`'ine
 * çevirir ve abonelere yayınlar. CarPlay ve mobil UI aynı örneği paylaşır.
 *
 * NOT: react-native-track-player henüz kurulmadığı için metod gövdeleri iskelet
 * halindedir. Paket kurulup native tarafı (iOS) yapılandırıldığında doldurulacak.
 * İskelet, arayüzü ve state yayınlama mekanizmasını şimdiden sabitler.
 */
export class TrackPlayerAudioService implements AudioPlayerService {
  private state: PlaybackState = INITIAL_PLAYBACK_STATE;
  private readonly listeners = new Set<(state: PlaybackState) => void>();

  async setup(): Promise<void> {
    // TODO: TrackPlayer.setupPlayer() + updateOptions(capabilities...) + event listener kaydı
  }

  async play(_episode: Episode): Promise<void> {
    // TODO: TrackPlayer.reset(); TrackPlayer.add({ id, url, title, artwork ... }); TrackPlayer.play();
    throw new Error('TrackPlayerAudioService.play: henüz implemente edilmedi.');
  }

  async resume(): Promise<void> {
    // TODO: TrackPlayer.play()
  }

  async pause(): Promise<void> {
    // TODO: TrackPlayer.pause()
  }

  async stop(): Promise<void> {
    // TODO: TrackPlayer.stop()
  }

  async seekTo(_positionSec: number): Promise<void> {
    // TODO: TrackPlayer.seekTo(positionSec)
  }

  async setRate(_rate: number): Promise<void> {
    // TODO: TrackPlayer.setRate(rate)
  }

  async getState(): Promise<PlaybackState> {
    return this.state;
  }

  subscribe(listener: (state: PlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  /** track-player olaylarından state güncellendiğinde çağrılır (iç kullanım). */
  private emit(next: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...next };
    this.listeners.forEach(l => l(this.state));
  }
}
