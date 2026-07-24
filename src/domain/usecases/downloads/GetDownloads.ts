import { Result } from '@core/error';
import { DownloadItem } from '../../entities';
import { DownloadRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/** GetDownloads — indirilen tüm bölümleri getirir (Kütüphane → İndirilenler). */
export class GetDownloads implements NoParamUseCase<readonly DownloadItem[]> {
  constructor(private readonly repo: DownloadRepository) {}

  execute(): Promise<Result<readonly DownloadItem[]>> {
    return this.repo.list();
  }
}
