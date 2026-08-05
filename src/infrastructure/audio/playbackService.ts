import TrackPlayer, { Event } from 'react-native-track-player';
import { remoteQueueHandlers } from './remoteQueueCommands';

const FORWARD_SEC = 30;
const BACKWARD_SEC = 15;

/**
 * Playback service — track-player'ın arka planda çalışan servis fonksiyonu.
 * index.js'de `registerPlaybackService` ile kaydedilir.
 *
 * Kilit ekranı, bildirim, CarPlay ve Android Auto'daki uzaktan kontrol
 * butonlarını (oynat/duraklat/ileri/geri/seek) native tarafta işler. Bu olaylar
 * TrackPlayer durumunu değiştirir; değişiklik TrackPlayerAudioService'in
 * PlaybackState dinleyicileri üzerinden UI'a geri yansır.
 */
export default async function playbackService(): Promise<void> {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());

  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
    TrackPlayer.seekTo(position),
  );

  TrackPlayer.addEventListener(Event.RemoteJumpForward, async ({ interval }) => {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(position + (interval ?? FORWARD_SEC));
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, position - (interval ?? BACKWARD_SEC)));
  });

  // Sonraki/önceki BÖLÜM (track-player'ın kendi kuyruğu değil, uygulamanınki).
  // Hangi bölümün sıradaki olduğunu kuyruk bilir; köprü üzerinden sorulur.
  TrackPlayer.addEventListener(Event.RemoteNext, () => remoteQueueHandlers().next());
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    remoteQueueHandlers().previous(),
  );

  /**
   * Bölüm sonuna gelindi → kuyrukta sonrakine geç.
   *
   * Oynatıcıya HER SEFERİNDE tek bölüm yüklenir (kuyruk uygulamanındır), bu
   * yüzden bir bölüm bitince track-player'ın kendi kuyruğu boşalır ve bu olay
   * düşer. Dinleyici olmadığı için oynatma bölüm sonunda sessizce duruyordu:
   * sıra dolu olsa bile sonraki bölüme geçilmiyordu.
   *
   * Kuyruğun sonundaysak `next()` hiçbir şey yapmaz; oynatma doğal olarak
   * biter.
   */
  TrackPlayer.addEventListener(Event.PlaybackQueueEnded, () =>
    remoteQueueHandlers().next(),
  );
}
