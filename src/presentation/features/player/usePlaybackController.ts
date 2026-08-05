import { useCallback } from 'react';
import { Episode } from '@domain/entities';
import { useDependencies } from '../../di';
import { setPlaybackSession, usePlayerQueueStore, usePlayerStore } from '../../stores';

export interface PlayContext {
  readonly episodes: Episode[];
  readonly index: number;
}

/** İlk 10 sn içindeyken geri → önceki bölüm; sonrası → başa sar. */
const BACK_TO_PREVIOUS_THRESHOLD_SEC = 10;

/**
 * usePlaybackController — oynatma akışının çekirdeği (navigasyonsuz).
 *
 * play(): yeni bir bağlam kurar ve "kaldığın yerden" çalar.
 * playIndex(): MEVCUT kuyrukta başka bir bölüme atlar — kuyruğu yeniden
 * kurmaz, yalnızca konumu değiştirir.
 * next/previous: kuyruğa göre sonraki/önceki bölüm; previous, konum 10 sn'den
 * fazlaysa bölümü başa sarar.
 *
 * usePlayEpisode bunu sarıp Player'ı açar; Player içi ileri/geri navigasyonsuz
 * kullanır.
 */
export const usePlaybackController = () => {
  const { continueEpisode, seekTo, analytics, pausePlayback, resumePlayback } =
    useDependencies();

  /** Oynatmayı başlatır; KUYRUĞA DOKUNMAZ. */
  const start = useCallback(
    async (episode: Episode) => {
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

  const play = useCallback(
    async (episode: Episode, context?: PlayContext) => {
      // Kuyruk ve çalan bölüm tek yerden kurulur (bkz. setPlaybackSession);
      // CarPlay de aynı noktadan geçer, iki yüzey ayrışamaz.
      setPlaybackSession(context?.episodes ?? [episode], context?.index ?? 0);
      await start(episode);
    },
    [start],
  );

  /**
   * Kuyrukta başka bir bölüme atlar.
   *
   * `play` çağırmak kuyruğu YENİDEN KURARDI ve tüm öğeler `context` olurdu —
   * yani kullanıcının sıraya eklediği bölümler sıradan bağlam öğelerine
   * dönüşür, ayrım kaybolurdu.
   */
  const playIndex = useCallback(
    (i: number) => {
      const { items } = usePlayerQueueStore.getState();
      const episode = items[i]?.episode;
      if (!episode) {
        return;
      }
      usePlayerQueueStore.setState({ index: i });
      usePlayerStore.getState().setCurrentEpisode(episode);
      void start(episode);
    },
    [start],
  );

  /**
   * Oynat/duraklat — açık olan bölüm için doğru eylemi seçer.
   *
   * Uygulama yeni açıldığında mini player'da bir bölüm durur ama o bölüm henüz
   * oynatıcıya YÜKLENMEMİŞTİR; orada "devam et" demek hiçbir şey yapmaz. Bu
   * durumda kaldığı yerden baştan yüklenir. Ayrım `currentEpisodeId`
   * karşılaştırmasıyla yapılır: oynatıcının gerçekten neyi tuttuğunu o söyler.
   */
  const togglePlay = useCallback(async () => {
    const { currentEpisode, playback } = usePlayerStore.getState();
    if (!currentEpisode) {
      return;
    }
    if (playback.status === 'playing') {
      await pausePlayback.execute();
      return;
    }
    if (playback.currentEpisodeId !== currentEpisode.id) {
      await play(currentEpisode);
      return;
    }
    await resumePlayback.execute();
  }, [pausePlayback, play, resumePlayback]);

  const next = useCallback(() => {
    const { items, index } = usePlayerQueueStore.getState();
    if (index >= 0 && index < items.length - 1) {
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

  return { play, playIndex, togglePlay, next, previous };
};
