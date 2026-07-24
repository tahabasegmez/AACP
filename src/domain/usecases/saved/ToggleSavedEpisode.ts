import { Result } from '@core/error';
import { Episode } from '../../entities';
import { SavedEpisodesRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface ToggleSavedEpisodeParams {
  readonly episode: Episode;
}

/** ToggleSavedEpisode — bölümü "Sonra dinle"ye ekler/çıkarır; yeni durumu döner. */
export class ToggleSavedEpisode implements UseCase<ToggleSavedEpisodeParams, boolean> {
  constructor(private readonly repo: SavedEpisodesRepository) {}

  execute(params: ToggleSavedEpisodeParams): Promise<Result<boolean>> {
    return this.repo.toggle(params.episode);
  }
}
