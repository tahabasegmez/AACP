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
  /**
   * Bölümü kuyruğun SONUNA ekler.
   *
   * Aynı bölüm birden çok kez sıraya alınabilir — çalan bölümü tekrar sıraya
   * eklemek geçerli bir istektir ve sessizce yok sayılmamalıdır. Bu yüzden
   * kuyruk kopya içerebilir; listeler öğeleri konuma göre anahtarlar.
   */
  enqueue: (episode: Episode) => void;
  /** Bölümü çalanın hemen ARDINA ekler ("sıradaki olarak çal"). */
  enqueueNext: (episode: Episode) => void;
  /** Kuyruktaki bir öğeyi KONUMUNA göre çıkarır (kopyalar olabileceği için). */
  removeAt: (position: number) => void;
  /**
   * Bir öğeyi kuyrukta başka bir konuma taşır (sürükle-bırak).
   * Çalan bölümün indeksi, taşıma onu kaydırdıysa güncellenir.
   */
  moveItem: (from: number, to: number) => void;
}

export const usePlayerQueueStore = create<QueueState>((set, get) => ({
  episodes: [],
  index: -1,
  setQueue: (episodes, index) => set({ episodes, index }),

  enqueue: episode => {
    const { episodes } = get();
    set({ episodes: [...episodes, episode] });
  },

  enqueueNext: episode => {
    const { episodes, index } = get();
    // Çalanın hemen ardına yerleştir; kuyruk boşsa sona ekle.
    const at = index >= 0 ? Math.min(index + 1, episodes.length) : episodes.length;
    set({ episodes: [...episodes.slice(0, at), episode, ...episodes.slice(at)] });
  },

  moveItem: (from, to) => {
    const { episodes, index } = get();
    if (
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= episodes.length ||
      to >= episodes.length
    ) {
      return;
    }

    const next = [...episodes];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    // Çalan bölümün yeni konumu: taşınan öğe oysa hedefe gider, değilse
    // kaydırmadan etkilenip etkilenmediğine bakılır. Aksi halde kuyruk
    // yeniden sıralandığında yanlış bölüm "çalıyor" görünürdü.
    let nextIndex = index;
    if (index === from) {
      nextIndex = to;
    } else if (from < index && to >= index) {
      nextIndex = index - 1;
    } else if (from > index && to <= index) {
      nextIndex = index + 1;
    }

    set({ episodes: next, index: nextIndex });
  },

  removeAt: position => {
    const { episodes, index } = get();
    if (position < 0 || position >= episodes.length) {
      return;
    }
    set({
      episodes: episodes.filter((_, i) => i !== position),
      // Çalan öğeden önce bir şey çıkarıldıysa indeks kayar.
      index: position < index ? index - 1 : index,
    });
  },
}));
