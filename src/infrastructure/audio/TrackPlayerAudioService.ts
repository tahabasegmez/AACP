import { Episode, INITIAL_PLAYBACK_STATE, PlaybackState } from '@domain/entities';
import { Logger } from '@core/logger';
import {
  AudioPlayerService,
  QueueItem,
  QueueSnapshot,
} from '@domain/services';
import TrackPlayer, {
  AppKilledPlaybackBehavior,
  Event,
  IOSCategory,
  IOSCategoryMode,
} from 'react-native-track-player';
import {
  REMOTE_CONTROL_LAYOUT,
  SEEK_BACKWARD_SEC,
  SEEK_FORWARD_SEC,
  notificationCapabilities,
  remoteCapabilities,
} from './remoteControls';
import { PermissionsAndroid, Platform } from 'react-native';
import { NativeNowPlayingSession } from './NativeNowPlayingSession';
import {
  episodeToNowPlaying,
  episodeToTrack,
  mapTrackPlayerState,
  trackToQueueItem,
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
  /** Kilit ekranı / Dynamic Island kartının "çalıyor mu" bilgisi. */
  private readonly nowPlayingSession = new NativeNowPlayingSession();
  private readonly subscriptions: Array<{ remove: () => void }> = [];
  /**
   * Süren/biten kurulum — BAYRAK DEĞİL, SÖZ tutulur.
   *
   * Kurulumu artık iki bağımsız yüzey isteyebiliyor (telefon arayüzü ve CarPlay
   * sahnesi) ve hangisinin önce geleceği belli değil. Bayrak yeterli değildi:
   * iki çağrı aynı anda gelirse ikisi de bayrağı boş görür, `setupPlayer` iki
   * kez çalışır ve ikincisi `player_already_initialized` ile patlardı. Söz
   * hatırlandığında ikinci çağıran aynı kurulumu BEKLER — döndüğünde oynatıcı
   * gerçekten hazırdır.
   */
  private setupPromise?: Promise<void>;

  setup(): Promise<void> {
    if (!this.setupPromise) {
      // Kurulum başarısız olursa söz UNUTULUR: sonraki deneme (ör. kullanıcı
      // uygulamayı öne getirdiğinde) yeniden şansını bulsun.
      this.setupPromise = this.runSetup().catch(error => {
        this.setupPromise = undefined;
        throw error;
      });
    }
    return this.setupPromise;
  }

  private async runSetup(): Promise<void> {
    await requestNotificationPermission();
    // iOS: Playback kategorisi + SpokenAudio modu → arka plan sesi VE Now Playing
    // (kilit ekranı + Dynamic Island medya kartı). Podcast için doğru profil.
    await TrackPlayer.setupPlayer({
      autoHandleInterruptions: true,
      iosCategory: IOSCategory.Playback,
      iosCategoryMode: IOSCategoryMode.SpokenAudio,
    });
    try {
      await TrackPlayer.updateOptions({
        progressUpdateEventInterval: 1,
        // Oynatma kartındaki taşıma tuşları TEK yerden gelir: hangi tuşların
        // çıkacağı bir ürün kararıdır, oynatıcı ayarı değil (remoteControls).
        capabilities: remoteCapabilities(REMOTE_CONTROL_LAYOUT),
        // (v4'teki `compactCapabilities` v5'te kaldırıldı; daraltılmış
        // bildirim ayrı olarak yapılandırılmıyor.)
        notificationCapabilities: notificationCapabilities(REMOTE_CONTROL_LAYOUT),
        forwardJumpInterval: SEEK_FORWARD_SEC,
        backwardJumpInterval: SEEK_BACKWARD_SEC,
        android: {
          appKilledPlaybackBehavior:
            AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
      });
    } catch (error) {
      // Kart yapılandırılamazsa oynatma yine kurulmalı: aksi halde durum
      // dinleyicileri hiç bağlanmaz ve tüm oynatma arayüzü sessizce ölür.
      this.logger?.error('Oynatma kartı yapılandırılamadı', error);
    }
    this.registerListeners();
  }

  // --- kuyruk ---------------------------------------------------------------
  //
  // Sıralama işlerinin tamamı track-player'ın KENDİ kuyruğuna devredilir
  // (`setQueue`, `add`, `move`, `remove`, `skip*`). Uygulama ikinci bir kuyruk
  // TUTMAZ: kilit ekranı, Dynamic Island, CarPlay ve direksiyon tuşları aynı
  // sırayı görsün diye tek gerçek kaynak burasıdır.

  async setQueue(
    episodes: readonly Episode[],
    index: number,
    startPositionSec = -1,
  ): Promise<void> {
    const start = Math.max(0, Math.min(index, episodes.length - 1));
    const target = episodes[start];
    if (!target) {
      await TrackPlayer.reset();
      return;
    }

    // Dokunuşla ses arasındaki boşlukta arayüz "yükleniyor" göstersin.
    this.update({
      status: 'loading',
      currentEpisodeId: target.id,
      positionSec: startPositionSec > 0 ? startPositionSec : 0,
      durationSec: target.durationSec,
    });

    await TrackPlayer.setQueue(
      episodes.map(episode => episodeToTrack({ episode, source: 'context' })),
    );
    // Başlangıç saniyesini kütüphane uygular: ayrıca seek etmek parçanın
    // başını bir an duyurup sonra atlamak olurdu.
    await TrackPlayer.skip(start, startPositionSec);
    await TrackPlayer.play();
    await this.refreshCard(target);
  }

  /**
   * Kullanıcı eklemesi çalanın ardındaki KULLANICI BLOĞUNUN sonuna girer.
   *
   * Böylece "şunu da dinleyeyim" denen bölüm, şovun kendiliğinden gelen
   * bölümlerinin önüne geçer; birden çok ekleme kendi aralarında sırasını korur.
   */
  async enqueue(episode: Episode): Promise<void> {
    const { items, index } = await this.getQueue();
    let at = index >= 0 ? index + 1 : items.length;
    while (at < items.length && items[at].source === 'user') {
      at += 1;
    }
    await TrackPlayer.add(episodeToTrack({ episode, source: 'user' }), at);
  }

  async removeAt(index: number): Promise<void> {
    await TrackPlayer.remove(index);
  }

  async moveItem(from: number, to: number): Promise<void> {
    await TrackPlayer.move(from, to);
  }

  async skipTo(index: number, startPositionSec = -1): Promise<void> {
    // Kütüphane başlangıç saniyesini kendisi uygular; ayrıca seek etmek
    // parçanın başını bir an duyurup sonra atlamak olurdu.
    await TrackPlayer.skip(index, startPositionSec);
    await TrackPlayer.play();
  }

  async skipToNext(): Promise<void> {
    await TrackPlayer.skipToNext();
  }

  async skipToPrevious(): Promise<void> {
    await TrackPlayer.skipToPrevious();
  }

  async getQueue(): Promise<QueueSnapshot> {
    try {
      const [tracks, index] = await Promise.all([
        TrackPlayer.getQueue(),
        TrackPlayer.getActiveTrackIndex(),
      ]);
      const items = tracks
        .map(trackToQueueItem)
        .filter((item): item is QueueItem => item !== null);
      return { items, index: index ?? -1 };
    } catch {
      // Player henüz hazır değil: boş kuyruk, çağıranlar bunu zaten karşılar.
      return { items: [], index: -1 };
    }
  }

  /**
   * Oynatma kartını (kilit ekranı / CarPlay) açıkça tazeler.
   *
   * Kuyruk kurulurken kart bir an boş kalabiliyor; bu çağrı dolmasını
   * garantiler. Başarısız olursa oynatma etkilenmez.
   */
  private async refreshCard(episode: Episode): Promise<void> {
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
    // Kartın "çalıyor mu" ve "bu bir ses parçası" bilgilerini track-player
    // YAZMIYOR; durumun tek geçtiği yer burası olduğu için sisteme buradan
    // bildirilir (bkz. NativeNowPlayingSession).
    this.nowPlayingSession.sync(this.state.status, this.state.currentEpisodeId);
    this.listeners.forEach(listener => listener(this.state));
  }
}
