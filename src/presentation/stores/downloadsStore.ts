import { DownloadItem } from '@domain/entities';
import { create } from 'zustand';

/**
 * downloadsStore — indirme kayıtlarının reaktif kopyası (episodeId → item).
 * Kalıcı kaynak DownloadRepository; bu store UI'ın anlık gösterimi içindir
 * (indiriliyor/indirildi rozetleri). AppRoot hydrate eder, controller günceller.
 */
interface DownloadsState {
  items: Record<string, DownloadItem>;
  setAll: (items: readonly DownloadItem[]) => void;
  upsert: (item: DownloadItem) => void;
  remove: (episodeId: string) => void;
}

export const useDownloadsStore = create<DownloadsState>(set => ({
  items: {},
  setAll: items =>
    set({ items: Object.fromEntries(items.map(i => [i.episodeId, i])) }),
  upsert: item =>
    set(state => ({ items: { ...state.items, [item.episodeId]: item } })),
  remove: episodeId =>
    set(state => {
      const next = { ...state.items };
      delete next[episodeId];
      return { items: next };
    }),
}));
