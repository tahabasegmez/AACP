import { useCallback } from 'react';
import { Preferences } from '@domain/entities';
import { useDependencies } from '../../di';
import { usePreferencesStore } from '../../stores';

/**
 * usePreferences — tercihleri okur ve günceller (hem anlık store hem kalıcı depo).
 * SettingsScreen bunu kullanır; değişiklik anında uygulanır ve kaydedilir.
 */
export const usePreferences = () => {
  const prefs = usePreferencesStore(s => s.prefs);
  const setPrefs = usePreferencesStore(s => s.setPrefs);
  const { savePreferences } = useDependencies();

  const update = useCallback(
    (patch: Partial<Preferences>) => {
      const next = { ...prefs, ...patch };
      setPrefs(next);
      savePreferences.execute(next).catch(() => {
        /* kayıt best-effort; hatada sessiz geç */
      });
    },
    [prefs, setPrefs, savePreferences],
  );

  return { prefs, update };
};
