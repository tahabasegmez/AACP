import { Result } from '@core/error';
import { FollowRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface IsFollowedParams {
  readonly showId: string;
}

/** IsFollowed — bir şovun takip edilip edilmediğini döner. */
export class IsFollowed implements UseCase<IsFollowedParams, boolean> {
  constructor(private readonly repo: FollowRepository) {}

  execute(params: IsFollowedParams): Promise<Result<boolean>> {
    return this.repo.isFollowed(params.showId);
  }
}
