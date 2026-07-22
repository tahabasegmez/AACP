import { Result } from '@core/error';
import { PlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface GetPlaybackProgressParams {
  readonly episodeId: string;
}

/**
 * GetPlaybackProgress — bir bölümün kayıtlı konumunu getirir (yoksa null).
 * UI, bölüm kartında "kaldığın yer" çubuğunu göstermek için kullanır.
 */
export class GetPlaybackProgress
  implements UseCase<GetPlaybackProgressParams, PlaybackProgress | null>
{
  constructor(private readonly repo: PlaybackProgressRepository) {}

  execute(
    params: GetPlaybackProgressParams,
  ): Promise<Result<PlaybackProgress | null>> {
    return this.repo.get(params.episodeId);
  }
}
