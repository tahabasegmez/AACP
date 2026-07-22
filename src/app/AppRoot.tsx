import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DependencyProvider,
  QueryProvider,
  RootNavigator,
  ThemeProvider,
  useDependencies,
  usePlayerStore,
} from '@presentation';
import { composeDependencies } from './di';

/**
 * AppRoot — uygulamanın kökü (composition root'un React tarafı).
 *
 * Sıralama: bağımlılıkları kur → sağlayıcılarla (DI, Query, Theme, Navigation)
 * ağacı sarmala → oynatıcı durumunu store'a köprüle.
 */
export const AppRoot: React.FC = () => {
  // Bağımlılıklar uygulama ömrü boyunca tek örnek olmalı.
  const dependencies = useMemo(() => composeDependencies(), []);

  return (
    <SafeAreaProvider>
      <DependencyProvider dependencies={dependencies}>
        <QueryProvider>
          <ThemeProvider>
            <PlayerStateBridge />
            <NavigationContainer>
              <RootNavigator />
            </NavigationContainer>
          </ThemeProvider>
        </QueryProvider>
      </DependencyProvider>
    </SafeAreaProvider>
  );
};

/**
 * AudioPlayerService'in yayınladığı durumu Zustand playerStore'a aktarır.
 * Böylece UI, player kütüphanesini tanımadan güncel oynatma durumunu görür.
 */
const PlayerStateBridge: React.FC = () => {
  const { audioPlayer } = useDependencies();
  const setPlayback = usePlayerStore(s => s.setPlayback);

  useEffect(() => {
    audioPlayer.setup();
    const unsubscribe = audioPlayer.subscribe(setPlayback);
    return unsubscribe;
  }, [audioPlayer, setPlayback]);

  return null;
};
