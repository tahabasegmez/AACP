import { Episode } from '@domain/entities';
import { PlaybackSessionService, QueueSnapshot } from '@domain/services';
import { playbackSession, setPlaybackSession } from '@presentation/stores';

/**
 * PlaybackSessionAdapter — oynatma oturumu portunu uygulamanın durumuna bağlar.
 *
 * app katmanında (composition root) durur çünkü domain portunu ve presentation
 * durumunu birlikte bilmesi gerekir; `@carplay` yalnızca portu tanır.
 *
 * Telefondaki oynatma akışı da AYNI `setPlaybackSession` fonksiyonundan geçer —
 * iki yüzeyin ayrışması bu sayede mümkün değil.
 */
export class PlaybackSessionAdapter implements PlaybackSessionService {
  setContext(episodes: readonly Episode[], index: number): void {
    setPlaybackSession(episodes, index);
  }

  getQueue(): QueueSnapshot {
    return playbackSession();
  }
}
