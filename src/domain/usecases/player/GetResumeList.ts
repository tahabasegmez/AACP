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
    const open = result.value.filter(p => !p.completed && p.positionSec > 0);
    return ok(dedupeByEpisode(open));
  }
}

/**
 * Bölüm başına TEK kayıt bırakır (en yeni damgalı kazanır).
 *
 * Depoda kayıtlar bölüm kimliğine göre tutulur, ama senkronizasyonla gelen
 * veri geçmişte farklı bir anahtarla yazılmış olabilir. Aynı bölümün listede
 * iki kez görünmesi her yüzeyde (telefon, CarPlay) hatalıdır; bu yüzden
 * ayıklama tek noktada — use case'te — yapılır.
 */
const dedupeByEpisode = (
  items: readonly PlaybackProgress[],
): readonly PlaybackProgress[] => {
  const newest = new Map<string, PlaybackProgress>();
  for (const item of items) {
    const existing = newest.get(item.episodeId);
    if (!existing || existing.updatedAt.localeCompare(item.updatedAt) < 0) {
      newest.set(item.episodeId, item);
    }
  }
  return [...newest.values()];
};
