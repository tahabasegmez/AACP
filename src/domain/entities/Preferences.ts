/**
 * Preferences — kullanıcının uygulama tercihleri (tema, hareket seviyesi).
 * Yerelde saklanır; ileride hesap senkronu eklenebilir (port sayesinde).
 */
export type ThemeMode = 'system' | 'dark' | 'light';

/** Hareket seviyesi: 'full' zengin animasyon, 'reduced' azaltılmış. */
export type MotionLevel = 'full' | 'reduced';

export interface Preferences {
  readonly themeMode: ThemeMode;
  readonly motion: MotionLevel;
}

export const DEFAULT_PREFERENCES: Preferences = {
  themeMode: 'system',
  motion: 'full',
};

/** Kısmi/eski kayıtları güvenli varsayılanlarla birleştirir. */
export const normalizePreferences = (raw: Partial<Preferences> | null | undefined): Preferences => ({
  themeMode:
    raw?.themeMode === 'dark' || raw?.themeMode === 'light' || raw?.themeMode === 'system'
      ? raw.themeMode
      : DEFAULT_PREFERENCES.themeMode,
  motion: raw?.motion === 'reduced' ? 'reduced' : DEFAULT_PREFERENCES.motion,
});
