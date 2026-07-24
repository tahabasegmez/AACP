import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { openPlayer } from '../../navigation/navigationRef';
import { PlayContext, usePlaybackController } from './usePlaybackController';

/**
 * usePlayEpisode — bir bölümü "kaldığın yerden" çalıp Player'ı açan ortak akış.
 *
 * Player'ı `navigationRef` ile açar (useNavigation DEĞİL); böylece
 * NavigationContainer dışındaki global bileşenlerden de (ör. EpisodeSheet)
 * güvenle çağrılabilir. İsteğe bağlı `context` verilirse Player'daki ileri/geri
 * bu kuyruk üzerinde çalışır.
 */
export const usePlayEpisode = () => {
  const { play } = usePlaybackController();

  return useCallback(
    async (episode: Episode, context?: PlayContext) => {
      openPlayer();
      await play(episode, context);
    },
    [play],
  );
};
