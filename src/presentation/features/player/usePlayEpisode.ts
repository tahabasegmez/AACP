import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { useDependencies } from '../../di';
import { usePlayerStore } from '../../stores';
import { useAppNavigation } from '../../navigation/useAppNavigation';

/**
 * usePlayEpisode — bir bölümü "kaldığın yerden" çalıp Player'ı açan ortak akış.
 * Home kartları, tam listeler ve şov detayı bunu paylaşır (tek doğru yol).
 */
export const usePlayEpisode = () => {
  const { continueEpisode } = useDependencies();
  const setCurrentEpisode = usePlayerStore(s => s.setCurrentEpisode);
  const navigation = useAppNavigation();

  return useCallback(
    async (episode: Episode) => {
      setCurrentEpisode(episode);
      navigation.navigate('Player', { episodeId: episode.id });
      await continueEpisode.execute({ episode });
    },
    [continueEpisode, setCurrentEpisode, navigation],
  );
};
