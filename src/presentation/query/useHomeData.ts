import { unwrap } from '@core/error';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/** "Dinlemeye devam" — yarıda kalmış bölümlerin konumları (yerel, hızlı). */
export const useResumeList = () => {
  const { getResumeList } = useDependencies();
  return useQuery({
    queryKey: queryKeys.resume,
    queryFn: async () => unwrap(await getResumeList.execute()),
  });
};

/** Takip edilen şovlar (Kütüphane + "yeni bölümler" satırını besler). */
export const useFollowedShows = () => {
  const { getFollowedShows } = useDependencies();
  return useQuery({
    queryKey: queryKeys.followedShows,
    queryFn: async () => unwrap(await getFollowedShows.execute()),
  });
};

/**
 * Takip edilen şovların en yeni bölümleri. feedUrls boşsa sorgu çalışmaz
 * (takip yoksa ağa çıkılmaz).
 */
export const useLatestEpisodes = (feedUrls: readonly string[]) => {
  const { getLatestEpisodes } = useDependencies();
  return useQuery({
    queryKey: queryKeys.latestEpisodes(feedUrls),
    enabled: feedUrls.length > 0,
    queryFn: async () => unwrap(await getLatestEpisodes.execute({ feedUrls })),
  });
};

/** Bir şovun takip durumu. */
export const useIsFollowed = (showId: string) => {
  const { isFollowed } = useDependencies();
  return useQuery({
    queryKey: queryKeys.isFollowed(showId),
    queryFn: async () => unwrap(await isFollowed.execute({ showId })),
  });
};

/**
 * Takip et/bırak — optimistic; başarınca ilgili sorguları tazeler.
 * Böylece Kütüphane ve şov detayı anında güncellenir.
 */
export const useToggleFollow = () => {
  const { toggleFollow } = useDependencies();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (showId: string) => unwrap(await toggleFollow.execute({ showId })),
    onSuccess: (_result, showId) => {
      qc.invalidateQueries({ queryKey: queryKeys.followedShows });
      qc.invalidateQueries({ queryKey: queryKeys.isFollowed(showId) });
    },
  });
};
