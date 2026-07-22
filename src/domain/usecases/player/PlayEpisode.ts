import { Result } from '@core/error';
import { Episode } from '../../entities';
import { AudioPlayerService } from '../../services';
import { UseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

export interface PlayEpisodeParams {
  readonly episode: Episode;
  /** Verilirse oynatma bu saniyeden başlar (kaldığı yerden devam için). */
  readonly startPositionSec?: number;
}

/**
 * PlayEpisode — bir bölümü çalmaya başlar (opsiyonel olarak belirli bir konumdan).
 *
 * Oynatma kütüphanesini (track-player) doğrudan çağırmak yerine bu use case
 * kullanılır; böylece hem mobil UI hem CarPlay aynı giriş noktasını paylaşır.
 * "Kaldığı yerden devam" akışı `ContinueEpisode` use case'i tarafından, kayıtlı
 * konum okunup `startPositionSec` olarak verilerek sağlanır.
 */
export class PlayEpisode implements UseCase<PlayEpisodeParams, void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(params: PlayEpisodeParams): Promise<Result<void>> {
    return runPlayback(async () => {
      await this.player.play(params.episode);
      if (params.startPositionSec && params.startPositionSec > 0) {
        await this.player.seekTo(params.startPositionSec);
      }
    });
  }
}
