import { DEFAULT_PREFERENCES, Preferences } from '@domain/entities';
import { create } from 'zustand';

/**
 * preferencesStore — kullanıcı tercihlerinin (tema, hareket) anlık kopyası.
 * AppRoot açılışta kalıcı depodan hydrate eder; SettingsScreen değişince hem
 * bunu günceller hem kalıcıya yazar. ThemeProvider ve animasyonlar bunu okur.
 */
interface PreferencesState {
  prefs: Preferences;
  setPrefs: (prefs: Preferences) => void;
}

export const usePreferencesStore = create<PreferencesState>(set => ({
  prefs: DEFAULT_PREFERENCES,
  setPrefs: prefs => set({ prefs }),
}));
