import { Episode } from '@domain/entities';
import { create } from 'zustand';

/**
 * playerQueueStore — o an çalınan bağlamın kuyruğu (bölüm listesi + geçerli indeks).
 * Player'daki "sonraki/önceki bölüm" bu kuyruğa göre çalışır. Bir şovdan çalınca
 * kuyruk = o şovun (sıralı) bölümleri olur; tekil çalmada tek elemanlı olur.
 */
interface QueueState {
  episodes: Episode[];
  index: number;
  setQueue: (episodes: Episode[], index: number) => void;
}

export const usePlayerQueueStore = create<QueueState>(set => ({
  episodes: [],
  index: -1,
  setQueue: (episodes, index) => set({ episodes, index }),
}));
