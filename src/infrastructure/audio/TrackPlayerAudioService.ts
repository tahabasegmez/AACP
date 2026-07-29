import { Episode, INITIAL_PLAYBACK_STATE, PlaybackState } from '@domain/entities';
import { AudioPlayerService } from '@domain/services';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Capability,
  Event,
  IOSCategory,
  IOSCategoryMode,
} from 'react-native-track-player';
import { episodeToTrack, mapTrackPlayerState } from './playbackMapping';

/**
 * TrackPlayerAudioService — AudioPlayerService portunun react-native-track-player
 * implementasyonu.
 *
 * track-player olaylarını dinleyip domain `PlaybackState`'ine çevirir ve abonelere
 * yayınlar. CarPlay ve mobil UI aynı örneği paylaşır. Saf dönüşümler
 * `playbackMapping`'te (ayrı test edilir); bu sınıf ince bir sarmalayıcıdır.
 *
 * Kilit ekranı / CarPlay uzaktan kontrolleri (RemotePlay/Pause/Seek...) native
 * "playback service" tarafında ele alınır (bkz. playbackService.ts) ve durum
 * yine buradaki PlaybackState dinleyicileri üzerinden geri yansır.
 */
export class TrackPlayerAudioService implements AudioPlayerService {
  private state: PlaybackState = INITIAL_PLAYBACK_STATE;
  private readonly listeners = new Set<(state: PlaybackState) => void>();
  private readonly subscriptions: Array<{ remove: () => void }> = [];
  private isSetup = false;

  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }
    // iOS: Playback kategorisi + SpokenAudio modu → arka plan sesi VE Now Playing
    // (kilit ekranı + Dynamic Island medya kartı). Podcast için doğru profil.
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
    });
    await TrackPlayer.updateOptions({
      progressUpdateEventInterval: 1,
      // SkipToNext/Previous, CarPlay ve direksiyon tuşlarının "sonraki/önceki
      // bölüm" komutlarını açar; kuyruk yönetimi playbackService'te yapılır.
      capabilities: [
        Capability.Play,
        Capability.Pause,
        Capability.Stop,
        Capability.SeekTo,
        Capability.JumpForward,
        Capability.JumpBackward,
        Capability.SkipToNext,
        Capability.SkipToPrevious,
      ],
      compactCapabilities: [Capability.Play, Capability.Pause, Capability.SeekTo],
      forwardJumpInterval: 30,
      backwardJumpInterval: 15,
      android: {
        appKilledPlaybackBehavior:
          AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
      },
    });
    this.registerListeners();
    this.isSetup = true;
  }

  async play(episode: Episode): Promise<void> {
    this.update({
      status: 'loading',
      currentEpisodeId: episode.id,
      positionSec: 0,
      durationSec: episode.durationSec,
    });
    await TrackPlayer.reset();
    await TrackPlayer.add(episodeToTrack(episode));
    await TrackPlayer.play();
  }

  async resume(): Promise<void> {
    await TrackPlayer.play();
  }

  async pause(): Promise<void> {
    await TrackPlayer.pause();
  }

  async stop(): Promise<void> {
    await TrackPlayer.stop();
  }

  async seekTo(positionSec: number): Promise<void> {
    await TrackPlayer.seekTo(positionSec);
  }

  async setRate(rate: number): Promise<void> {
    await TrackPlayer.setRate(rate);
    this.update({ rate });
  }

  async getState(): Promise<PlaybackState> {
    try {
      const [{ state }, progress] = await Promise.all([
        TrackPlayer.getPlaybackState(),
        TrackPlayer.getProgress(),
      ]);
      this.update({
        status: mapTrackPlayerState(state),
        positionSec: progress.position,
        durationSec: progress.duration || this.state.durationSec,
        bufferedSec: progress.buffered ?? 0,
      });
    } catch {
      // Player henüz hazır değilse mevcut (son bilinen) durumu döneriz.
    }
    return this.state;
  }

  subscribe(listener: (state: PlaybackState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** track-player olaylarını dinleyip domain durumunu günceller. */
  private registerListeners(): void {
    this.subscriptions.push(
      TrackPlayer.addEventListener(Event.PlaybackState, ({ state }) => {
        this.update({ status: mapTrackPlayerState(state) });
      }),
      TrackPlayer.addEventListener(
        Event.PlaybackProgressUpdated,
        ({ position, duration, buffered }) => {
          this.update({
            positionSec: position,
            durationSec: duration,
            // Yerel dosyada buffer raporlanmayabilir; süreye eşitlemek yerine
            // ham değer taşınır ve yorumu UI yapar.
            bufferedSec: buffered ?? 0,
          });
        },
      ),
      TrackPlayer.addEventListener(
        Event.PlaybackActiveTrackChanged,
        ({ track }) => {
          this.update({ currentEpisodeId: track?.id ?? this.state.currentEpisodeId });
        },
      ),
    );
  }

  private update(partial: Partial<PlaybackState>): void {
    this.state = { ...this.state, ...partial };
    this.listeners.forEach(listener => listener(this.state));
  }
}
