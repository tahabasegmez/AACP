import { useEffect } from 'react';
import { setRemoteQueueHandlers } from '@infrastructure';
import { usePlayerStore } from '../../stores';
import { usePlaybackController } from './usePlaybackController';

/**
 * RemoteQueueBridge — "sonraki/önceki bölüm" uzaktan komutlarını kuyruğa bağlar.
 *
 * Bu komutlar CarPlay'den, kilit ekranından ve direksiyon tuşlarından gelir ve
 * arka plan servisinde karşılanır. Kuyruk ise burada (presentation) yaşadığı
 * için ikisi bir köprüyle buluşturulur: altyapı yalnızca sözleşmeyi bilir,
 * kuyruğun nerede olduğunu bilmez.
 *
 * "Önceki" davranışı uygulamadaki kuralla aynıdır: bölümün başına yakınsa
 * gerçekten önceki bölüme geçer, değilse mevcut bölümü başa sarar.
 */
export const RemoteQueueBridge: React.FC = () => {
  const { next, previous } = usePlaybackController();

  useEffect(() => {
    setRemoteQueueHandlers({
      next: () => next(),
      // Konum, komutun geldiği anda okunur (store'dan) — böylece köprü
      // güncel duruma göre karar verir.
      previous: () => previous(usePlayerStore.getState().playback.positionSec),
    });

    return () => setRemoteQueueHandlers(undefined);
  }, [next, previous]);

  return null;
};
