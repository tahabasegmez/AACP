import { INITIAL_PLAYBACK_STATE, Episode, PlaybackState } from '@domain/entities';
import { create } from 'zustand';

/**
 * playerStore — oynatıcının UI state'i (Zustand).
 *
 * Gerçek oynatma işini AudioPlayerService (track-player) yapar; bu store yalnızca
 * UI'ın hızlı erişmesi gereken anlık durumu ve o an çalan bölümü tutar.
 * app/AppRoot, AudioPlayerService.subscribe ile bu store'u güncel tutar.
 */
interface PlayerStoreState {
  playback: PlaybackState;
  currentEpisode: Episode | null;
  setPlayback: (playback: PlaybackState) => void;
  setCurrentEpisode: (episode: Episode | null) => void;
}

export const usePlayerStore = create<PlayerStoreState>(set => ({
  playback: INITIAL_PLAYBACK_STATE,
  currentEpisode: null,
  setPlayback: playback => set({ playback }),
  setCurrentEpisode: currentEpisode => set({ currentEpisode }),
}));
