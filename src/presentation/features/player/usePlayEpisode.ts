import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { useAppNavigation } from '../../navigation/useAppNavigation';
import { PlayContext, usePlaybackController } from './usePlaybackController';

/**
 * usePlayEpisode — bir bölümü "kaldığın yerden" çalıp Player'ı açan ortak akış.
 * İsteğe bağlı `context` (bölüm listesi + indeks) verilirse Player'daki ileri/geri
 * bu kuyruk üzerinde çalışır (ör. bir şovun bölüm listesinden çalarken).
 */
export const usePlayEpisode = () => {
  const { play } = usePlaybackController();
  const navigation = useAppNavigation();

  return useCallback(
    async (episode: Episode, context?: PlayContext) => {
      navigation.navigate('Player', { episodeId: episode.id });
      await play(episode, context);
    },
    [play, navigation],
  );
};
