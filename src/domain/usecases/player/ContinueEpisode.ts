import { Result } from '@core/error';
import { Episode } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { UseCase } from '../UseCase';
import { PlayEpisode } from './PlayEpisode';

export interface ContinueEpisodeParams {
  readonly episode: Episode;
}

/**
 * ContinueEpisode — bir bölümü "kaldığı yerden" çalar.
 *
 * Kayıtlı konumu okur; bölüm daha önce yarıda bırakılmışsa o saniyeden başlar,
 * yoksa (veya tamamlanmışsa) baştan çalar. Konum okuma + oynatma mantığını tek
 * yerde birleştirir; UI ve CarPlay "devam et" için sadece bunu çağırır.
 */
export class ContinueEpisode implements UseCase<ContinueEpisodeParams, void> {
  constructor(
    private readonly progressRepo: PlaybackProgressRepository,
    private readonly playEpisode: PlayEpisode,
  ) {}

  async execute(params: ContinueEpisodeParams): Promise<Result<void>> {
    const progressResult = await this.progressRepo.get(params.episode.id);

    // Konum okunamasa bile oynatmayı engellememeliyiz: hata olursa baştan başlat.
    let startPositionSec = 0;
    if (progressResult.ok && progressResult.value && !progressResult.value.completed) {
      startPositionSec = progressResult.value.positionSec;
    }

    return this.playEpisode.execute({
      episode: params.episode,
      startPositionSec,
    });
  }
}
