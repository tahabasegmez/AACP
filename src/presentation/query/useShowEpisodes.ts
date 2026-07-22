import { unwrap } from '@core/error';
import { EpisodeSortOrder } from '@domain/entities';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

const PAGE_SIZE = 20;

export interface UseShowEpisodesOptions {
  readonly search?: string;
  readonly sort?: EpisodeSortOrder;
}

/**
 * useShowEpisodes — bir şovun bölümlerini sayfalı (sonsuz kaydırma) getirir.
 *
 * `GetShowEpisodes` use case'ini sararak arama/sıralama/sayfalama uygular.
 * `fetchNextPage()` ile bir sonraki sayfa gelir; feed cache'lendiği için sonraki
 * sayfalar ağa çıkmaz. Şov meta verisi her sayfada döner (ilk sayfadan okunur).
 */
export const useShowEpisodes = (
  feedUrl: string | undefined,
  options?: UseShowEpisodesOptions,
) => {
  const { getShowEpisodes } = useDependencies();
  const search = options?.search ?? '';
  const sort: EpisodeSortOrder = options?.sort ?? 'newest';

  return useInfiniteQuery({
    queryKey: queryKeys.showEpisodes(feedUrl ?? '', search, sort),
    enabled: Boolean(feedUrl),
    initialPageParam: 0,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await getShowEpisodes.execute({
          feedUrl,
          limit: PAGE_SIZE,
          offset: pageParam,
          search,
          sort,
        }),
      ),
    getNextPageParam: lastPage =>
      lastPage.episodes.hasMore
        ? lastPage.episodes.offset + lastPage.episodes.limit
        : undefined,
  });
};
