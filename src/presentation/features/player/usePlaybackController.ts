import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { useDependencies } from '../../di';
import { setPlaybackSession, usePlayerQueueStore } from '../../stores';

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
  const { continueEpisode, seekTo, analytics } = useDependencies();

  const play = useCallback(
    async (episode: Episode, context?: PlayContext) => {
      // Kuyruk ve çalan bölüm tek yerden kurulur (bkz. setPlaybackSession);
      // CarPlay de aynı noktadan geçer, iki yüzey ayrışamaz.
      setPlaybackSession(context?.episodes ?? [episode], context?.index ?? 0);
      // Telemetri: hangi bölüm/şov çalındı (kişisel veri içermez).
      analytics.track('episode_play', {
        episodeId: episode.id,
        showId: episode.showId,
        durationSec: episode.durationSec,
      });
      await continueEpisode.execute({ episode });
    },
    [analytics, continueEpisode],
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
