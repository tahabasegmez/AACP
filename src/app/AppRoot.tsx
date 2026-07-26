import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
} from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  DependencyProvider,
  EpisodeSheet,
  GlobalDock,
  QueryProvider,
  RootNavigator,
  SyncRunner,
  ThemeProvider,
  TopScrim,
  navigationRef,
  resetScrim,
  useDependencies,
  useDownloads,
  usePlayerStore,
  useRouteStore,
  useSleepTimerStore,
  useTheme,
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <DependencyProvider dependencies={dependencies}>
          <QueryProvider>
            <ThemeProvider>
              <PlayerStateBridge />
              <SleepTimerRunner />
              <DownloadsHydrator />
              <SyncRunner />
              <Navigation />
              <EpisodeSheet />
            </ThemeProvider>
          </QueryProvider>
        </DependencyProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

/** DownloadsHydrator — açılışta indirilenler listesini store'a yükler. */
const DownloadsHydrator: React.FC = () => {
  const { hydrate } = useDownloads();
  useEffect(() => {
    hydrate();
  }, [hydrate]);
  return null;
};

/**
 * Navigation — NavigationContainer'ı uygulama temasıyla besler (beyaz geçiş
 * parlamalarını önler; zemin ve accent tema token'larından gelir).
 */
const Navigation: React.FC = () => {
  const theme = useTheme();
  const setRouteName = useRouteStore(s => s.setRouteName);
  const navTheme: NavTheme = {
    ...(theme.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.dark ? DarkTheme : DefaultTheme).colors,
      primary: theme.colors.accent,
      background: theme.colors.bg,
      card: theme.colors.bg,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  };
  // Aktif rota adını takip et (global mini player'ın konumu/görünürlüğü için).
  const syncRoute = useCallback(() => {
    setRouteName(navigationRef.getCurrentRoute()?.name);
    resetScrim(); // yeni ekran en üstten başlar → scrim'i sıfırla
  }, [setRouteName]);

  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} theme={navTheme} onReady={syncRoute} onStateChange={syncRoute}>
        <RootNavigator />
      </NavigationContainer>
      {/* Global mini player + çevrimdışı şeridi — navigasyonun üstünde overlay. */}
      <GlobalDock />
      {/* Aşağı kaydırıldıkça island çevresini koyulaştıran üst scrim (tek örnek). */}
      <TopScrim />
    </View>
  );
};

/**
 * SleepTimerRunner — uyku zamanlayıcı süresi dolunca oynatmayı duraklatır.
 * Player ekranından bağımsız (store'dan beslenir) çalışır.
 */
const SleepTimerRunner: React.FC = () => {
  const { pausePlayback } = useDependencies();
  const endsAt = useSleepTimerStore(s => s.endsAt);
  const setEndsAt = useSleepTimerStore(s => s.setEndsAt);

  useEffect(() => {
    if (!endsAt) {
      return;
    }
    const fire = () => {
      pausePlayback.execute().catch(() => {});
      setEndsAt(null);
    };
    const ms = endsAt - Date.now();
    if (ms <= 0) {
      fire();
      return;
    }
    const id = setTimeout(fire, ms);
    return () => clearTimeout(id);
  }, [endsAt, pausePlayback, setEndsAt]);

  return null;
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
        // "Dinlemeye devam" kartının başlık/kapak gösterip doğrudan çalabilmesi
        // için o an çalan bölümün meta'sını da kaydet.
        const ep = usePlayerStore.getState().currentEpisode;
        savePlaybackProgress
          .execute({
            episodeId: currentEpisodeId,
            positionSec,
            durationSec,
            episodeTitle: ep?.title,
            showId: ep?.showId,
            artworkUrl: ep?.imageUrl,
            audioUrl: ep?.audioUrl,
          })
          .catch(() => {
            /* progress kaydı best-effort; hatada sessiz geç */
          });
      }
    });
    return unsubscribe;
  }, [audioPlayer, savePlaybackProgress, setPlayback]);

  return null;
};
