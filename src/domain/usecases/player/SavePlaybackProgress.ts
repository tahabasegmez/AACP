import { Result } from '@core/error';
import { PlaybackProgressInfo, buildPlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface SavePlaybackProgressParams extends PlaybackProgressInfo {
  readonly episodeId: string;
  readonly positionSec: number;
  readonly durationSec: number;
}

/**
 * SavePlaybackProgress — bir bölümün anlık konumunu (ve varsa gösterim meta'sını)
 * kaydeder. Oynatma sırasında periyodik ve duraklat/çık anlarında çağrılır.
 */
export class SavePlaybackProgress
  implements UseCase<SavePlaybackProgressParams, void>
{
  constructor(private readonly repo: PlaybackProgressRepository) {}

  execute(params: SavePlaybackProgressParams): Promise<Result<void>> {
    const progress = buildPlaybackProgress(
      params.episodeId,
      params.positionSec,
      params.durationSec,
      new Date(),
      {
        episodeTitle: params.episodeTitle,
        showId: params.showId,
        artworkUrl: params.artworkUrl,
        audioUrl: params.audioUrl,
      },
    );
    return this.repo.save(progress);
  }
}
