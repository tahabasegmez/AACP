import { Episode } from '@domain/entities';
import { PlaybackQueueService, QueueSnapshot } from '@domain/services';
import { usePlayerQueueStore } from '@presentation/stores';

/**
 * PlayerQueueAdapter — kuyruk portunu uygulamanın oynatıcı kuyruğuna bağlar.
 *
 * app katmanında (composition root) durur çünkü domain portunu ve presentation
 * store'unu birlikte bilmesi gerekir; `@carplay` yalnızca portu tanır.
 *
 * Store dışında React'e ihtiyaç yoktur: zustand store'u bileşen dışından da
 * okunup yazılabilir (`getState`), CarPlay de React ağacının dışındadır.
 */
export class PlayerQueueAdapter implements PlaybackQueueService {
  setQueue(episodes: readonly Episode[], index: number): void {
    usePlayerQueueStore.getState().setQueue([...episodes], index);
  }

  getQueue(): QueueSnapshot {
    const { episodes, index } = usePlayerQueueStore.getState();
    return { episodes, index };
  }
}
