import React, { createContext, useContext } from 'react';
import { Theme, darkTheme } from './theme';

const ThemeContext = createContext<Theme>(darkTheme);

/**
 * ThemeProvider — uygulama teması KOYUYA SABİT (marka kimliği koyu tema üzerine
 * kuruludur). Tüm token'lar `darkTheme`'den gelir. İleride tekrar açık/otomatik
 * tema istenirse burada sistem tercihine göre seçim yapılır; bileşenler değişmez.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <ThemeContext.Provider value={darkTheme}>{children}</ThemeContext.Provider>;

export const useTheme = (): Theme => useContext(ThemeContext);
