import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { usePreferencesStore } from '../stores/preferencesStore';
import { Theme, darkTheme, lightTheme } from './theme';

const ThemeContext = createContext<Theme>(darkTheme);

/**
 * ThemeProvider — temayı kullanıcı tercihine + sistem moduna göre seçer.
 * themeMode 'system' ise sistemi izler; aksi halde zorlanan modu kullanır.
 * VARSAYILAN KOYU: sistem "light" demedikçe koyu tema.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const scheme = useColorScheme();
  const themeMode = usePreferencesStore(s => s.prefs.themeMode);
  const effective = themeMode === 'system' ? scheme : themeMode;
  const theme = effective === 'light' ? lightTheme : darkTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => useContext(ThemeContext);
