import { Result } from '@core/error';
import { Episode } from '../../entities';
import { SavedEpisodesRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/** GetSavedEpisodes — "Sonra dinle" listesini getirir. */
export class GetSavedEpisodes implements NoParamUseCase<readonly Episode[]> {
  constructor(private readonly repo: SavedEpisodesRepository) {}

  execute(): Promise<Result<readonly Episode[]>> {
    return this.repo.list();
  }
}
