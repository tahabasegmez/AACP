import { unwrap } from '@core/error';
import { Episode, Playlist, SAVED_PLAYLIST_ID } from '@domain/entities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/** Kullanıcının tüm listeleri (sistem listesi dahil). */
export const usePlaylists = () => {
  const { getPlaylists } = useDependencies();
  return useQuery({
    queryKey: queryKeys.playlists,
    queryFn: async () => unwrap(await getPlaylists.execute()),
  });
};

/** Tek bir liste (id ile). Listeler tek sorgudan süzülür — ek istek yok. */
export const usePlaylist = (playlistId?: string) => {
  const query = usePlaylists();
  return {
    ...query,
    data: playlistId ? query.data?.find(p => p.id === playlistId) : undefined,
  };
};

/** "Sonra dinle" sistem listesi — uygulamanın her yerinde aynı liste. */
export const useSavedPlaylist = () => usePlaylist(SAVED_PLAYLIST_ID);

/**
 * Liste değiştiren işlemler tek yerde toplanır; hepsi başarıda liste sorgusunu
 * tazeler, böylece her ekran güncel veriyi görür.
 */
const useInvalidatePlaylists = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: queryKeys.playlists });
};

export const useCreatePlaylist = () => {
  const { createPlaylist } = useDependencies();
  const invalidate = useInvalidatePlaylists();
  return useMutation({
    mutationFn: async (input: { name: string; coverUri?: string }) =>
      unwrap(await createPlaylist.execute(input)),
    onSuccess: invalidate,
  });
};

export const useUpdatePlaylist = () => {
  const { updatePlaylist } = useDependencies();
  const invalidate = useInvalidatePlaylists();
  return useMutation({
    mutationFn: async (params: { playlistId: string; name?: string; coverUri?: string }) =>
      unwrap(await updatePlaylist.execute(params)),
    onSuccess: invalidate,
  });
};

export const useDeletePlaylist = () => {
  const { deletePlaylist } = useDependencies();
  const invalidate = useInvalidatePlaylists();
  return useMutation({
    mutationFn: async (playlistId: string) =>
      unwrap(await deletePlaylist.execute({ playlistId })),
    onSuccess: invalidate,
  });
};

export const useAddEpisodeToPlaylist = () => {
  const { addEpisodeToPlaylist } = useDependencies();
  const invalidate = useInvalidatePlaylists();
  return useMutation({
    mutationFn: async (params: { playlistId: string; episode: Episode }) =>
      unwrap(await addEpisodeToPlaylist.execute(params)),
    onSuccess: invalidate,
  });
};

export const useRemoveEpisodeFromPlaylist = () => {
  const { removeEpisodeFromPlaylist } = useDependencies();
  const invalidate = useInvalidatePlaylists();
  return useMutation({
    mutationFn: async (params: { playlistId: string; episodeId: string }) =>
      unwrap(await removeEpisodeFromPlaylist.execute(params)),
    onSuccess: invalidate,
  });
};

/** Kullanıcının kendi oluşturduğu listeler (sistem listesi hariç). */
export const userPlaylists = (playlists?: readonly Playlist[]): readonly Playlist[] =>
  (playlists ?? []).filter(p => !p.system);
