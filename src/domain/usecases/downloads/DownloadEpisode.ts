import { Result } from '@core/error';
import { DownloadItem, Episode } from '../../entities';
import { DownloadRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface DownloadEpisodeParams {
  readonly episode: Episode;
}

/** DownloadEpisode — bir bölümü çevrimdışı için indirir. */
export class DownloadEpisode implements UseCase<DownloadEpisodeParams, DownloadItem> {
  constructor(private readonly repo: DownloadRepository) {}

  execute(params: DownloadEpisodeParams): Promise<Result<DownloadItem>> {
    return this.repo.download(params.episode);
  }
}
