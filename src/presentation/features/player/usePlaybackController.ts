import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { useDependencies } from '../../di';
import { usePlayerQueueStore, usePlayerStore } from '../../stores';

export interface PlayContext {
  readonly episodes: Episode[];
  readonly index: number;
}

/** İlk 10 sn içindeyken geri → önceki bölüm; sonrası → başa sar. */
const BACK_TO_PREVIOUS_THRESHOLD_SEC = 10;

/**
 * usePlaybackController — oynatma akışının çekirdeği (navigasyonsuz).
 *
 * play(): kuyruğu kurar, "kaldığın yerden" çalar. next/previous: kuyruğa göre
 * sonraki/önceki bölüm. previous, konum 10 sn'den fazlaysa bölümü başa sarar.
 * usePlayEpisode bunu sarıp Player'ı açar; Player içi ileri/geri navigasyonsuz kullanır.
 */
export const usePlaybackController = () => {
  const { continueEpisode, seekTo } = useDependencies();
  const setCurrentEpisode = usePlayerStore(s => s.setCurrentEpisode);
  const setQueue = usePlayerQueueStore(s => s.setQueue);

  const play = useCallback(
    async (episode: Episode, context?: PlayContext) => {
      if (context) {
        setQueue(context.episodes, context.index);
      } else {
        setQueue([episode], 0);
      }
      setCurrentEpisode(episode);
      await continueEpisode.execute({ episode });
    },
    [continueEpisode, setCurrentEpisode, setQueue],
  );

  const playIndex = useCallback(
    (i: number) => {
      const { episodes } = usePlayerQueueStore.getState();
      const ep = episodes[i];
      if (ep) {
        void play(ep, { episodes, index: i });
      }
    },
    [play],
  );

  const next = useCallback(() => {
    const { episodes, index } = usePlayerQueueStore.getState();
    if (index >= 0 && index < episodes.length - 1) {
      playIndex(index + 1);
    }
  }, [playIndex]);

  const previous = useCallback(
    (positionSec: number) => {
      const { index } = usePlayerQueueStore.getState();
      if (positionSec <= BACK_TO_PREVIOUS_THRESHOLD_SEC && index > 0) {
        playIndex(index - 1);
      } else {
        void seekTo.execute({ positionSec: 0 });
      }
    },
    [playIndex, seekTo],
  );

  return { play, next, previous };
};
