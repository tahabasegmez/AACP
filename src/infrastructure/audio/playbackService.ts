import TrackPlayer, { Event } from 'react-native-track-player';
import { SEEK_BACKWARD_SEC, SEEK_FORWARD_SEC } from './remoteControls';

/**
 * Playback service — track-player'ın arka planda çalışan servis fonksiyonu.
 * index.js'de `registerPlaybackService` ile kaydedilir.
 *
 * Kilit ekranı, bildirim, Dynamic Island, CarPlay ve Android Auto'daki uzaktan
 * kontrol tuşlarını native tarafta işler. Bu olaylar TrackPlayer durumunu
 * değiştirir; değişiklik TrackPlayerAudioService'in PlaybackState dinleyicileri
 * üzerinden UI'a geri yansır.
 *
 * KUYRUK KOMUTLARI DOĞRUDAN KÜTÜPHANEYE GİDER. Bir dönem "sonraki/önceki
 * bölüm" uygulamanın kendi kuyruğuna el yapımı bir köprüyle bağlanıyordu:
 * kuyruk presentation'da, oynatıcıda ise tek parça vardı ve ikisi ayrışıyordu —
 * kilit ekranındaki tuş uygulamadaki sırayı takip etmiyordu. Artık sıra
 * oynatıcının kendi kuyruğudur, köprüye gerek yoktur.
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
    await TrackPlayer.seekTo(position + (interval ?? SEEK_FORWARD_SEC));
  });

  TrackPlayer.addEventListener(Event.RemoteJumpBackward, async ({ interval }) => {
    const { position } = await TrackPlayer.getProgress();
    await TrackPlayer.seekTo(Math.max(0, position - (interval ?? SEEK_BACKWARD_SEC)));
  });

  // Sonraki/önceki BÖLÜM — kuyruğun sahibi oynatıcı olduğu için tek satır.
  // Kuyruğun ucundaysak kütüphane komutu kendisi yok sayar.
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious(),
  );

  // Bölüm sonunda sıradakine geçmek de kütüphanenin işi: kuyruk onda olduğu
  // için `PlaybackQueueEnded`'i elle karşılamaya gerek kalmadı.
}
