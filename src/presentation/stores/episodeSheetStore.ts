import { Episode } from '@domain/entities';
import { create } from 'zustand';

/**
 * episodeSheetStore — bölüm ayrıntı panelinin (bottom sheet) durumu.
 * Herhangi bir ekran open(episode) çağırır; kök seviyedeki EpisodeSheet tepki verir.
 * Böylece listelerde gezinirken hızlıca içerik görülüp panel kapatılabilir.
 */
interface EpisodeSheetState {
  episode: Episode | null;
  open: (episode: Episode) => void;
  close: () => void;
}

export const useEpisodeSheetStore = create<EpisodeSheetState>(set => ({
  episode: null,
  open: episode => set({ episode }),
  close: () => set({ episode: null }),
}));
