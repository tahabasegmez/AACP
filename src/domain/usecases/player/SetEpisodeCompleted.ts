import { Result } from '@core/error';
import { Episode, completedPlaybackProgress } from '../../entities';
import { PlaybackProgressRepository } from '../../repositories';
import { UseCase } from '../UseCase';

export interface SetEpisodeCompletedParams {
  readonly episode: Episode;
  readonly completed: boolean;
}

/**
 * SetEpisodeCompleted — bir bölümü elle "dinlendi" işaretler ya da işareti kaldırır.
 *
 * İşareti kaldırmak kaydı tümüyle SİLER: bölüm hiç açılmamış hâline döner.
 * Konumu koruyup yalnızca bayrağı düşürmek, "dinlemeye devam" listesinde
 * kullanıcının bilerek kapattığı bir bölümü geri getirirdi.
 */
export class SetEpisodeCompleted
  implements UseCase<SetEpisodeCompletedParams, void>
{
  constructor(private readonly repo: PlaybackProgressRepository) {}

  execute({ episode, completed }: SetEpisodeCompletedParams): Promise<Result<void>> {
    if (!completed) {
      return this.repo.remove(episode.id);
    }
    return this.repo.save(
      completedPlaybackProgress(episode.id, episode.durationSec, new Date(), {
        episodeTitle: episode.title,
        showId: episode.showId,
        artworkUrl: episode.imageUrl,
        audioUrl: episode.audioUrl,
      }),
    );
  }
}
