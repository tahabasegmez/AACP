import React, { useEffect, useMemo } from 'react';
import {
  DependencyProvider,
  EpisodeSheet,
  LastPlayedRestorer,
  PlaybackSessionBridge,
  QueryProvider,
  RemoteQueueBridge,
  SyncRunner,
  ThemeProvider,
  useDependencies,
  useDownloads,
  usePlayerStore,
  useProgressRecorder,
  useSleepTimerStore,
} from '@presentation';
import { getDependencies } from './di';

/**
 * PodcastProviders — podcast özelliğinin ÇALIŞMASI için gereken her şey:
 * bağımlılık grafiği, sorgu/tema sağlayıcıları ve arka plan yürütücüleri
 * (oynatıcı köprüsü, uyku zamanlayıcı, indirmeler, senkron).
 *
 * Navigasyon İÇERMEZ — bilinçli olarak. Böylece aynı ağaç iki modda kullanılır:
 *  - **Standalone**: `AppRoot` bunu kendi NavigationContainer'ıyla sarar.
 *  - **Gömülü**: ana uygulama bunu kökte kullanır, podcast ekranları da onun
 *    NavigationContainer'ı içinde yaşar.
 *
 * `children` bu sağlayıcıların altında render edilir; ana uygulama gömülü modda
 * TÜM uygulamasını buraya koyar (mini player her ekranda görünsün diye).
 */
export const PodcastProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Uygulama ömrü boyunca tek bağımlılık grafiği (CarPlay ile ortak).
  const dependencies = useMemo(() => getDependencies(), []);

  return (
    <DependencyProvider dependencies={dependencies}>
      <QueryProvider>
        <ThemeProvider>
          <PlayerStateBridge />
          <SleepTimerRunner />
          <DownloadsHydrator />
          <SyncRunner />
          {/* Hesabın en son dinlediği bölümü mini player'a geri yükler. */}
          <LastPlayedRestorer />
          {/* CarPlay / kilit ekranı "sonraki-önceki bölüm" komutlarını kuyruğa bağlar. */}
          <RemoteQueueBridge />
          {/* Aynı hesapta tek cihaz kuralı — oturum boyunca geçerli. */}
          <PlaybackSessionBridge />
          {children}
          {/* Bölüm ayrıntı paneli — navigasyondan bağımsız, kökte tek örnek. */}
          <EpisodeSheet />
        </ThemeProvider>
      </QueryProvider>
    </DependencyProvider>
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

/**
 * AudioPlayerService'in yayınladığı durumu Zustand playerStore'a aktarır ve
 * dinleme konumunu kalıcı kaydeder ("kaldığın yerden devam"). Böylece UI,
 * player kütüphanesini tanımadan güncel oynatma durumunu görür.
 *
 * Kaydın ne zaman yazılacağı `useProgressRecorder`'ın işidir: köprü yalnızca
 * her durumu ona iletir.
 */
const PlayerStateBridge: React.FC = () => {
  const { audioPlayer } = useDependencies();
  const setPlayback = usePlayerStore(s => s.setPlayback);
  const recordProgress = useProgressRecorder();

  useEffect(() => {
    audioPlayer.setup();
    const unsubscribe = audioPlayer.subscribe(state => {
      setPlayback(state);
      recordProgress(state);
    });
    return unsubscribe;
  }, [audioPlayer, recordProgress, setPlayback]);

  return null;
};
