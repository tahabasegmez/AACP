import { NavigationContainer } from '@react-navigation/native';
import React, { useEffect, useMemo, useRef } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DependencyProvider,
  QueryProvider,
  RootNavigator,
  ThemeProvider,
  useDependencies,
  usePlayerStore,
} from '@presentation';
import { getDependencies } from './di';

/**
 * AppRoot — uygulamanın kökü (composition root'un React tarafı).
 *
 * Sıralama: bağımlılıkları kur → sağlayıcılarla (DI, Query, Theme, Navigation)
 * ağacı sarmala → oynatıcı durumunu store'a köprüle.
 */
export const AppRoot: React.FC = () => {
  // Paylaşılan tek bağımlılık grafiği (CarPlay ile ortak).
  const dependencies = useMemo(() => getDependencies(), []);

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

/** Konumu en fazla bu aralıkla (saniye) kaydet — her emit'te yazmaktan kaçınır. */
const PROGRESS_SAVE_INTERVAL_SEC = 5;

/**
 * AudioPlayerService'in yayınladığı durumu Zustand playerStore'a aktarır ve
 * dinleme konumunu periyodik olarak kalıcı kaydeder ("kaldığın yerden devam").
 * Böylece UI, player kütüphanesini tanımadan güncel oynatma durumunu görür.
 */
const PlayerStateBridge: React.FC = () => {
  const { audioPlayer, savePlaybackProgress } = useDependencies();
  const setPlayback = usePlayerStore(s => s.setPlayback);
  const lastSavedPositionRef = useRef(0);

  useEffect(() => {
    audioPlayer.setup();
    const unsubscribe = audioPlayer.subscribe(state => {
      setPlayback(state);

      // Konumu seyrek kaydet: aktif oynatmada ve en az PROGRESS_SAVE_INTERVAL_SEC
      // ilerledikçe. Böylece storage'a sürekli yazmayız.
      const { currentEpisodeId, positionSec, durationSec, status } = state;
      const enoughProgressed =
        Math.abs(positionSec - lastSavedPositionRef.current) >=
        PROGRESS_SAVE_INTERVAL_SEC;
      if (
        currentEpisodeId &&
        (status === 'playing' || status === 'paused') &&
        enoughProgressed
      ) {
        lastSavedPositionRef.current = positionSec;
        savePlaybackProgress
          .execute({ episodeId: currentEpisodeId, positionSec, durationSec })
          .catch(() => {
            /* progress kaydı best-effort; hatada sessiz geç */
          });
      }
    });
    return unsubscribe;
  }, [audioPlayer, savePlaybackProgress, setPlayback]);

  return null;
};
