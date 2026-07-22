import { Result, ok } from '@core/error';
import { PlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { NoParamUseCase } from '../UseCase';

/**
 * GetResumeList — "Dinlemeye devam" listesi: yarıda bırakılmış (tamamlanmamış)
 * bölümlerin konum kayıtları, en son dinlenen en üstte.
 *
 * Ana ekranda bir "kaldığın yerden devam et" satırı için kullanılır.
 */
export class GetResumeList implements NoParamUseCase<readonly PlaybackProgress[]> {
  constructor(private readonly repo: PlaybackProgressRepository) {}

  async execute(): Promise<Result<readonly PlaybackProgress[]>> {
    const result = await this.repo.getAll();
    if (!result.ok) {
      return result;
    }
    return ok(result.value.filter(p => !p.completed && p.positionSec > 0));
  }
}
