import TrackPlayer, { Event } from 'react-native-track-player';

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
}
