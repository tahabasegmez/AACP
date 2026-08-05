import { Episode } from '@domain/entities';
import { queueEpisodes, usePlayerQueueStore } from './playerQueueStore';
import { usePlayerStore } from './playerStore';

/**
 * Oynatma bağlamını TEK yerden kurar: kuyruk + çalan bölüm.
 *
 * İkisi ayrı ayrı ayarlanabildiği sürece unutulabilir — nitekim CarPlay
 * yalnızca kuyruğu kurdu ve telefondaki kapak/başlık eski bölümde kaldı.
 * Oynatmayı başlatan HER yüzey (telefon, CarPlay, sesli komut) buradan geçer.
 *
 * `index` kuyruktaki çalan bölümün konumudur; kuyruk boşsa çalan bölüm de
 * temizlenir.
 */
export const setPlaybackSession = (
  episodes: readonly Episode[],
  index: number,
): void => {
  usePlayerQueueStore.getState().setQueue([...episodes], index);
  usePlayerStore.getState().setCurrentEpisode(episodes[index] ?? null);
};

/** O anki kuyruk ve çalan konum. */
export const playbackSession = (): {
  episodes: readonly Episode[];
  index: number;
} => {
  const { items, index } = usePlayerQueueStore.getState();
  return { episodes: queueEpisodes(items), index };
};
