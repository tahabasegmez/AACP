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
  /** Bölümü kuyruğun SONUNA ekler (zaten varsa taşımaz). */
  enqueue: (episode: Episode) => void;
  /** Bölümü çalanın hemen ARDINA ekler ("sıradaki olarak çal"). */
  enqueueNext: (episode: Episode) => void;
  /** Bölümü kuyruktan çıkarır. */
  removeFromQueue: (episodeId: string) => void;
}

export const usePlayerQueueStore = create<QueueState>((set, get) => ({
  episodes: [],
  index: -1,
  setQueue: (episodes, index) => set({ episodes, index }),

  enqueue: episode => {
    const { episodes } = get();
    if (episodes.some(e => e.id === episode.id)) {
      return; // kuyrukta zaten var
    }
    set({ episodes: [...episodes, episode] });
  },

  enqueueNext: episode => {
    const { episodes, index } = get();
    // Önce varsa mevcut kopyayı çıkar ki bölüm iki kez sıraya girmesin.
    const without = episodes.filter(e => e.id !== episode.id);
    const at = index >= 0 ? Math.min(index + 1, without.length) : without.length;
    set({
      episodes: [...without.slice(0, at), episode, ...without.slice(at)],
      // Çalan bölümün indeksi, ondan önce bir eleman çıkarıldıysa kayar.
      index: index >= 0 && episodes.findIndex(e => e.id === episode.id) < index ? index - 1 : index,
    });
  },

  removeFromQueue: episodeId => {
    const { episodes, index } = get();
    const at = episodes.findIndex(e => e.id === episodeId);
    if (at < 0) {
      return;
    }
    set({
      episodes: episodes.filter(e => e.id !== episodeId),
      index: at < index ? index - 1 : index,
    });
  },
}));
