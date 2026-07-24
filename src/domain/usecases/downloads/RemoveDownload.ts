import { Result } from '@core/error';
import { DownloadRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface RemoveDownloadParams {
  readonly episodeId: string;
}

/** RemoveDownload — indirilen bölümü ve dosyasını siler. */
export class RemoveDownload implements UseCase<RemoveDownloadParams, void> {
  constructor(private readonly repo: DownloadRepository) {}

  execute(params: RemoveDownloadParams): Promise<Result<void>> {
    return this.repo.remove(params.episodeId);
  }
}
