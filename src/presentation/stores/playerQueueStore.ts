import { Episode } from '@domain/entities';
import { create } from 'zustand';

/**
 * Bir kuyruk öğesinin NEREDEN geldiği.
 *
 *  - `context`: bir şova/listeye girip çalmaya başlayınca kendiliğinden gelen
 *    bölümler,
 *  - `user`: kullanıcının açıkça "sıraya ekle" dediği bölümler.
 *
 * Ayrım davranışsaldır, süsleme değil: kullanıcının eklediği bölüm bağlamın
 * ÖNÜNE geçer. "Şu bölümü de dinleyeyim" demek, o bölümü şovun geri kalanının
 * arkasına atmak anlamına gelmemeli.
 */
export type QueueSource = 'context' | 'user';

export interface QueueItem {
  readonly episode: Episode;
  readonly source: QueueSource;
}

/**
 * playerQueueStore — o an çalınan bağlamın kuyruğu.
 *
 * Dizinin SIRASI oynatma sırasıdır. Kullanıcı eklemeleri çalan bölümün hemen
 * ardında bir blok oluşturur; bağlam bölümleri onların arkasında kalır.
 */
interface QueueState {
  items: QueueItem[];
  index: number;
  /** Bağlamı kurar (şov/liste açılışı): tüm öğeler `context` olur. */
  setQueue: (episodes: Episode[], index: number) => void;
  /**
   * Kullanıcı eklemesi — çalanın ardındaki KULLANICI BLOĞUNUN sonuna girer.
   *
   * Aynı bölüm birden çok kez sıraya alınabilir; çalan bölümü tekrar sıraya
   * eklemek geçerli bir istektir ve sessizce yok sayılmamalıdır. Bu yüzden
   * kuyruk kopya içerebilir ve listeler öğeleri konuma göre anahtarlar.
   */
  enqueue: (episode: Episode) => void;
  /** Kuyruktaki bir öğeyi KONUMUNA göre çıkarır (kopyalar olabileceği için). */
  removeAt: (position: number) => void;
  /**
   * Bir öğeyi kuyrukta başka bir konuma taşır (sürükle-bırak).
   *
   * Taşıma öğenin KENDİ GRUBUYLA sınırlıdır: kullanıcı kuyruğundaki bir bölüm
   * bağlamın içine, bağlamdaki bir bölüm kullanıcı kuyruğuna sürüklenemez.
   * Sınırsız bırakılsaydı iki grup birbirine karışır ve paneldeki ayrım
   * anlamını yitirirdi.
   */
  moveItem: (from: number, to: number) => void;
}

/** `at` konumundaki öğeyle aynı kaynağa sahip, bitişik aralığın sınırları. */
const groupBounds = (items: readonly QueueItem[], at: number): [number, number] => {
  const { source } = items[at];
  let first = at;
  let last = at;
  while (first > 0 && items[first - 1].source === source) {
    first -= 1;
  }
  while (last < items.length - 1 && items[last + 1].source === source) {
    last += 1;
  }
  return [first, last];
};

export const usePlayerQueueStore = create<QueueState>((set, get) => ({
  items: [],
  index: -1,

  setQueue: (episodes, index) =>
    set({
      items: episodes.map(episode => ({ episode, source: 'context' as const })),
      index,
    }),

  enqueue: episode => {
    const { items, index } = get();
    // Çalanın ardındaki kullanıcı bloğunun SONU. Blok yoksa doğrudan çalanın
    // ardına girer; kuyruk boşsa sona eklenir.
    let at = index >= 0 ? index + 1 : items.length;
    while (at < items.length && items[at].source === 'user') {
      at += 1;
    }
    set({
      items: [...items.slice(0, at), { episode, source: 'user' }, ...items.slice(at)],
    });
  },

  moveItem: (from, to) => {
    const { items, index } = get();
    if (from === to || from < 0 || from >= items.length || to < 0 || to >= items.length) {
      return;
    }

    // Hedef, taşınan öğenin kendi grubuna sıkıştırılır.
    const [first, last] = groupBounds(items, from);
    const target = Math.max(first, Math.min(last, to));
    if (target === from) {
      return;
    }

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(target, 0, moved);

    // Çalan bölümün yeni konumu: taşınan öğe oysa hedefe gider, değilse
    // kaydırmadan etkilenip etkilenmediğine bakılır. Aksi halde kuyruk
    // yeniden sıralandığında yanlış bölüm "çalıyor" görünürdü.
    let nextIndex = index;
    if (index === from) {
      nextIndex = target;
    } else if (from < index && target >= index) {
      nextIndex = index - 1;
    } else if (from > index && target <= index) {
      nextIndex = index + 1;
    }

    set({ items: next, index: nextIndex });
  },

  removeAt: position => {
    const { items, index } = get();
    if (position < 0 || position >= items.length) {
      return;
    }
    set({
      items: items.filter((_, i) => i !== position),
      // Çalan öğeden önce bir şey çıkarıldıysa indeks kayar.
      index: position < index ? index - 1 : index,
    });
  },
}));

/** Kuyruğun düz bölüm listesi — kaynak bilgisine ihtiyaç duymayan çağıranlar için. */
export const queueEpisodes = (items: readonly QueueItem[]): Episode[] =>
  items.map(item => item.episode);
