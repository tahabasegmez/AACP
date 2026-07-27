import { Result } from '@core/error';
import { Episode, Playlist } from '../../entities';
import {
  CreatePlaylistInput,
  PlaylistRepository,
  UpdatePlaylistInput,
} from '../../repositories';
import { NoParamUseCase, UseCase } from '../UseCase';

/**
 * Playlist use case'leri.
 *
 * Hepsi ince sarmalayıcılardır: iş kuralı (ekleme/çıkarma, sistem listesi
 * koruması) entity ve repository'de yaşar. Yine de use case katmanı korunur —
 * UI repository'yi doğrudan tanımaz ve ileride kural eklemek (ör. "en fazla N
 * liste") tek noktadan mümkün olur.
 */

export class GetPlaylists implements NoParamUseCase<readonly Playlist[]> {
  constructor(private readonly repo: PlaylistRepository) {}
  execute(): Promise<Result<readonly Playlist[]>> {
    return this.repo.list();
  }
}

export class CreatePlaylist implements UseCase<CreatePlaylistInput, Playlist> {
  constructor(private readonly repo: PlaylistRepository) {}
  execute(params: CreatePlaylistInput): Promise<Result<Playlist>> {
    return this.repo.create(params);
  }
}

export interface UpdatePlaylistParams extends UpdatePlaylistInput {
  readonly playlistId: string;
}

export class UpdatePlaylist implements UseCase<UpdatePlaylistParams, Playlist> {
  constructor(private readonly repo: PlaylistRepository) {}
  execute({ playlistId, ...input }: UpdatePlaylistParams): Promise<Result<Playlist>> {
    return this.repo.update(playlistId, input);
  }
}

export class DeletePlaylist implements UseCase<{ playlistId: string }, void> {
  constructor(private readonly repo: PlaylistRepository) {}
  execute({ playlistId }: { playlistId: string }): Promise<Result<void>> {
    return this.repo.remove(playlistId);
  }
}

export interface PlaylistEpisodeParams {
  readonly playlistId: string;
  readonly episode: Episode;
}

export class AddEpisodeToPlaylist implements UseCase<PlaylistEpisodeParams, Playlist> {
  constructor(private readonly repo: PlaylistRepository) {}
  execute({ playlistId, episode }: PlaylistEpisodeParams): Promise<Result<Playlist>> {
    return this.repo.addEpisode(playlistId, episode);
  }
}

export class RemoveEpisodeFromPlaylist
  implements UseCase<{ playlistId: string; episodeId: string }, Playlist>
{
  constructor(private readonly repo: PlaylistRepository) {}
  execute(params: { playlistId: string; episodeId: string }): Promise<Result<Playlist>> {
    return this.repo.removeEpisode(params.playlistId, params.episodeId);
  }
}
