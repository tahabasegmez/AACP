import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';
import { Theme, darkTheme, lightTheme } from './theme';

const ThemeContext = createContext<Theme>(lightTheme);

/** Sistem açık/koyu moduna göre temayı sağlar. */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const scheme = useColorScheme();
  const theme = scheme === 'dark' ? darkTheme : lightTheme;
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): Theme => useContext(ThemeContext);
