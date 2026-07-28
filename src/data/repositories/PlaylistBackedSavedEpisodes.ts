import { Result, fail, ok } from '@core/error';
import { Episode, SAVED_PLAYLIST_ID, playlistHasEpisode } from '@domain/entities';
import { PlaylistRepository, SavedEpisodesRepository } from '@domain/repositories';

/**
 * "Sonra dinle"yi PLAYLIST sistemi üzerinden sunar.
 *
 * NEDEN: "Sonra dinle" artık bağımsız bir depo değil, sistem playlist'idir
 * (`SAVED_PLAYLIST_ID`). Ayrı bir depo tutmak aynı veriyi iki yerde saklamak
 * ve iki kez senkronlamak demekti — kaynaklar sessizce sapabilirdi.
 *
 * Bu sınıf eski `SavedEpisodesRepository` portunu korur (use case'ler ve UI
 * değişmez) ama tüm okuma/yazmayı tek kaynağa yönlendirir.
 */
export class PlaylistBackedSavedEpisodes implements SavedEpisodesRepository {
  constructor(private readonly playlists: PlaylistRepository) {}

  async list(): Promise<Result<readonly Episode[]>> {
    const result = await this.playlists.get(SAVED_PLAYLIST_ID);
    if (!result.ok) {
      return fail(result.error);
    }
    // Sistem listesi her zaman vardır; yoksa boş liste döner.
    return ok(result.value?.episodes ?? []);
  }

  async isSaved(episodeId: string): Promise<Result<boolean>> {
    const result = await this.playlists.get(SAVED_PLAYLIST_ID);
    if (!result.ok) {
      return fail(result.error);
    }
    return ok(!!result.value && playlistHasEpisode(result.value, episodeId));
  }

  /** Ekli değilse ekler, ekliyse çıkarır; sonuçta "artık ekli mi" döner. */
  async toggle(episode: Episode): Promise<Result<boolean>> {
    const current = await this.playlists.get(SAVED_PLAYLIST_ID);
    if (!current.ok) {
      return fail(current.error);
    }
    const exists = !!current.value && playlistHasEpisode(current.value, episode.id);

    const updated = exists
      ? await this.playlists.removeEpisode(SAVED_PLAYLIST_ID, episode.id)
      : await this.playlists.addEpisode(SAVED_PLAYLIST_ID, episode);

    return updated.ok ? ok(!exists) : fail(updated.error);
  }
}
