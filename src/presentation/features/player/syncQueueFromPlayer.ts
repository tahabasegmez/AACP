import { AudioPlayerService } from '@domain/services';
import { usePlayerQueueStore, usePlayerStore } from '../../stores';

/**
 * Kuyruğun arayüzdeki yansımasını oynatıcıdan tazeler.
 *
 * Kuyruğun tek gerçek kaynağı oynatıcıdır; store yalnızca React'in abone
 * olabileceği bir kopyadır (bkz. playerQueueStore). Bu fonksiyon o kopyayı
 * güncelleyen TEK yerdir — kuyruğu değiştiren her yol buradan geçer:
 *
 *  - uygulama içindeki eylemler (`playbackController`),
 *  - uygulama dışından gelen komutlar: kilit ekranı, Dynamic Island, CarPlay,
 *    direksiyon tuşları ve bölüm bitince kütüphanenin kendi ilerlemesi
 *    (`bindPlaybackQueueSync`).
 */
export const syncQueueFromPlayer = async (
  player: AudioPlayerService,
): Promise<void> => {
  const snapshot = await player.getQueue();
  usePlayerQueueStore.getState().setSnapshot(snapshot);

  // Çalan bölüm de kuyruktan okunur: ikisini ayrı ayrı yazmak, birinin
  // unutulup arayüzün eski bölümde kalmasına kapı açıyordu.
  const playing = snapshot.items[snapshot.index]?.episode;
  if (playing) {
    usePlayerStore.getState().setCurrentEpisode(playing);
  }
};
