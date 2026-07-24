import { Result } from '@core/error';
import { FollowRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface ToggleFollowParams {
  readonly showId: string;
}

/** ToggleFollow — bir şovu takip et/bırak; yeni durumu (takipte mi) döner. */
export class ToggleFollow implements UseCase<ToggleFollowParams, boolean> {
  constructor(private readonly repo: FollowRepository) {}

  execute(params: ToggleFollowParams): Promise<Result<boolean>> {
    return this.repo.toggle(params.showId);
  }
}
