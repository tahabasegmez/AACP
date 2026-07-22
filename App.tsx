/**
 * AACP — Anadolu Ajansı Podcast
 *
 * Bu dosya yalnızca giriş noktasıdır; tüm kurulum src/app/AppRoot içindedir.
 * Mimari için: docs/ARCHITECTURE.md
 */
import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { AppRoot } from '@app';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  return (
    <>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppRoot />
    </>
  );
}

export default App;
