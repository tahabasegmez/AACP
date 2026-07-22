import { Result, fail, ok } from '@core/error';
import { AppError } from '@core/error';
import { Episode } from '../../entities';
import { AudioPlayerService } from '../../services';
import { UseCase } from '../UseCase';

export interface PlayEpisodeParams {
  readonly episode: Episode;
}

/**
 * PlayEpisode — bir bölümü çalmaya başlar.
 *
 * Oynatma kütüphanesini (track-player) doğrudan çağırmak yerine bu use case
 * kullanılır; böylece hem mobil UI hem CarPlay aynı giriş noktasını paylaşır
 * ve ileride "dinleme geçmişi kaydet" gibi iş kuralları buraya eklenebilir.
 */
export class PlayEpisode implements UseCase<PlayEpisodeParams, void> {
  constructor(private readonly player: AudioPlayerService) {}

  async execute(params: PlayEpisodeParams): Promise<Result<void>> {
    try {
      await this.player.play(params.episode);
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'PLAYBACK'));
    }
  }
}
