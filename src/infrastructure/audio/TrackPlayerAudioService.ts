import { Episode, INITIAL_PLAYBACK_STATE, PlaybackState } from '@domain/entities';
import { Logger } from '@core/logger';
import { AudioPlayerService } from '@domain/services';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Event,
  IOSCategory,
  IOSCategoryMode,
} from 'react-native-track-player';
import { PermissionsAndroid, Platform } from 'react-native';
import { NOTIFICATION_CAPABILITIES, remoteCapabilities } from './capabilities';
import {
  episodeToNowPlaying,
  episodeToTrack,
  mapTrackPlayerState,
} from './playbackMapping';

/**
 * Android 13+ bildirim izni.
 *
 * Oynatma kartı (kilit ekranı ve bildirim gölgesi kontrolleri) bir BİLDİRİM
 * olarak çizilir; izin verilmezse oynatma çalışır ama kullanıcı onu hiçbir
 * yerden kontrol edemez. Manifestte bildirmek yetmez, çalışma zamanında da
 * sorulmalıdır.
 *
 * Reddedilirse akış DEVAM EDER: izin oynatmanın ön koşulu değil, kontrol
 * yüzeyinin koşuludur.
 */
const requestNotificationPermission = async (): Promise<void> => {
  if (Platform.OS !== 'android' || Platform.Version < 33) {
    return;
  }
  try {
    await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
    );
  } catch {
    // İzin diyaloğu açılamadıysa oynatma yine kurulmalı.
  }
};

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
  constructor(private readonly logger?: Logger) {}

  private state: PlaybackState = INITIAL_PLAYBACK_STATE;
  private readonly listeners = new Set<(state: PlaybackState) => void>();
  private readonly subscriptions: Array<{ remove: () => void }> = [];
  private isSetup = false;

  async setup(): Promise<void> {
    if (this.isSetup) {
      return;
    }
    await requestNotificationPermission();
    // iOS: Playback kategorisi + SpokenAudio modu → arka plan sesi VE Now Playing
    // (kilit ekranı + Dynamic Island medya kartı). Podcast için doğru profil.
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
    });
    // Dinleyiciler kart yapılandırmasından ÖNCE bağlanır: `updateOptions`
    // patlarsa oynatma yine çalışmalı ve arayüz durumu görmeye devam etmeli.
    // Eskiden sıra tersti ve tek bir hata tüm oynatma durumunu sessizce
    // öldürüyordu.
    this.registerListeners();
    this.isSetup = true;

    try {
      await TrackPlayer.updateOptions({
        progressUpdateEventInterval: 1,
        // Yetenek listesi platforma göre üretilir; sebebi `capabilities.ts`de.
        capabilities: remoteCapabilities(Platform.OS),
        // Bildirim tuşları yalnızca Android kavramıdır.
        ...(Platform.OS === 'android'
          ? { notificationCapabilities: NOTIFICATION_CAPABILITIES }
          : {}),
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
      });
    } catch (error) {
      // Kart yapılandırılamadı: kilit ekranı kontrolleri eksik kalır ama ses
      // çalar. Sessizce yutmak, sorunun yıllarca fark edilmemesi demekti.
      this.logger?.error('Oynatma kartı yapılandırılamadı', error);
    }
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

    // Oynatma kartını (kilit ekranı / CarPlay) açıkça tazele. `reset()` kartı
    // temizlediği için parça değişiminde boş kalabiliyor; bu çağrı kartın
    // dolmasını garantiler. Başarısız olursa oynatma etkilenmez.
    try {
      await TrackPlayer.updateNowPlayingMetadata(episodeToNowPlaying(episode));
    } catch {
      /* kart tazelenemedi; ses çalmaya devam eder */
    }
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
