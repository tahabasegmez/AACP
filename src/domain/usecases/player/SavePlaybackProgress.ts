import { Result } from '@core/error';
import { buildPlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface SavePlaybackProgressParams {
  readonly episodeId: string;
  readonly positionSec: number;
  readonly durationSec: number;
}

/**
 * SavePlaybackProgress — bir bölümün anlık konumunu kaydeder.
 *
 * Oynatma sırasında periyodik olarak (ör. birkaç saniyede bir) ve duraklat/çık
 * anlarında çağrılır. Tamamlanma durumunu entity içinde hesaplar.
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
    );
    return this.repo.save(progress);
  }
}
