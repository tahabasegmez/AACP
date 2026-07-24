import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, darkTheme, lightTheme } from './theme';

const ThemeContext = createContext<Theme>(darkTheme);

/**
 * ThemeProvider — sistem açık/koyu moduna göre temayı sağlar.
 * VARSAYILAN KOYU: sistem "light" demedikçe koyu tema kullanılır.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const scheme = useColorScheme();
  const theme = scheme === 'light' ? lightTheme : darkTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => useContext(ThemeContext);
