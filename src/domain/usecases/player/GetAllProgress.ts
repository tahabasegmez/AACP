import { Result } from '@core/error';
import { PlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/**
 * GetAllProgress — TÜM "kaldığın yer" kayıtları (tamamlananlar dahil).
 *
 * `GetResumeList` yalnızca yarıda kalanları döner; listelerde bir bölümün
 * "dinlendi" işaretini göstermek için tamamlananlar da gerekir. İki ayrı
 * use case olması bilinçli: "dinlemeye devam" bir ÜRÜN kavramı, bu ise ham
 * kayıt erişimi.
 */
export class GetAllProgress implements NoParamUseCase<readonly PlaybackProgress[]> {
  constructor(private readonly repo: PlaybackProgressRepository) {}

  execute(): Promise<Result<readonly PlaybackProgress[]>> {
    return this.repo.getAll();
  }
}
