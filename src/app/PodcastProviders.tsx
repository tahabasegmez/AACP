import React, { useEffect, useMemo, useRef } from 'react';
import {
  DependencyProvider,
  EpisodeSheet,
  QueryProvider,
  SyncRunner,
  ThemeProvider,
  useDependencies,
  useDownloads,
  usePlayerStore,
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

      // Reklam çalarken ilerleme KAYDEDİLMEZ: reklamın konumu bölümün konumu
      // değildir; kaydedilse "kaldığın yer" bozulurdu.
      if (state.ad) {
        return;
      }

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
