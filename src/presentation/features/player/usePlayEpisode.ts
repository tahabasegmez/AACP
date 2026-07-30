import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { openPlayer } from '../../navigation/navigationRef';
import { usePlayerStore } from '../../stores';
import { PlayContext, usePlaybackController } from './usePlaybackController';

/**
 * usePlayEpisode — bir bölümü "kaldığın yerden" çalıp Player'ı açan ortak akış.
 *
 * Player'ı `navigationRef` ile açar (useNavigation DEĞİL); böylece
 * NavigationContainer dışındaki global bileşenlerden de (ör. EpisodeSheet)
 * güvenle çağrılabilir. İsteğe bağlı `context` verilirse Player'daki ileri/geri
 * bu kuyruk üzerinde çalışır.
 *
 * Zaten çalan bölüme dokunmak onu BAŞTAN başlatmaz; yalnızca Player'ı açar.
 * Aynı bölüm birçok yerde listelenir (şov, liste, indirilenler, arama) ve
 * hangisinden dokunulursa dokunulsun dinlenen yer kaybolmamalı.
 */
export const usePlayEpisode = () => {
  const { play } = usePlaybackController();

  return useCallback(
    async (episode: Episode, context?: PlayContext) => {
      openPlayer();
      if (usePlayerStore.getState().currentEpisode?.id === episode.id) {
        return;
      }
      await play(episode, context);
    },
    [play],
  );
};
