import { QueueItem, QueueSnapshot } from '@domain/services';
import { create } from 'zustand';

/**
 * playerQueueStore — kuyruğun ARAYÜZ İÇİN yansıması.
 *
 * Kuyruğun kendisi burada YAŞAMAZ; gerçek sıra oynatıcının kendi kuyruğudur
 * (bkz. AudioPlayerService). Bu store yalnızca React'in abone olabileceği bir
 * kopya tutar ve oynatıcı değiştikçe tazelenir.
 *
 * Bir dönem sıralama mantığı (ekleme, taşıma, çıkarma) burada yaşıyor,
 * oynatıcıya ise tek parça yükleniyordu. İki ayrı gerçek kaynak ayrışıyordu:
 * kilit ekranındaki ve Dynamic Island'daki "sonraki bölüm" uygulamadaki sırayı
 * takip etmiyordu. Mantık oynatıcıya taşındı; burada yalnızca gösterim kaldı.
 */
interface QueueState extends QueueSnapshot {
  /** Oynatıcıdan alınan güncel kuyruğu yazar (tek yazma noktası). */
  setSnapshot: (snapshot: QueueSnapshot) => void;
}

export const usePlayerQueueStore = create<QueueState>(set => ({
  items: [],
  index: -1,
  setSnapshot: ({ items, index }) => set({ items, index }),
}));

/** Kuyruğun düz bölüm listesi — kaynak bilgisine ihtiyaç duymayan çağıranlar için. */
export const queueEpisodes = (items: readonly QueueItem[]) =>
  items.map(item => item.episode);
