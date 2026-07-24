import { create } from 'zustand';

/**
 * sleepTimerStore — uyku zamanlayıcının bitiş zamanı (epoch ms) veya null (kapalı).
 * Player zamanlayıcıyı kurar; AppRoot'taki runner süre dolunca oynatmayı duraklatır.
 * Store'da tutulması, Player ekranı kapansa bile zamanlayıcının sürmesini sağlar.
 */
interface SleepTimerState {
  endsAt: number | null;
  setEndsAt: (endsAt: number | null) => void;
}

export const useSleepTimerStore = create<SleepTimerState>(set => ({
  endsAt: null,
  setEndsAt: endsAt => set({ endsAt }),
}));
