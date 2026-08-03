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
 * Sayfalama İMLEÇLİDİR: bir sonraki sayfa "kaçıncı öğeden" değil "nerede
 * kalındığı" ile istenir. İmlecin içeriği burada YORUMLANMAZ — kaynak ne
 * verdiyse aynen geri gönderilir; sunucu ve RSS kaynakları farklı biçimler
 * kullanır ve bu fark buraya sızmamalıdır.
 *
 * Arama ve sıralama sorgu anahtarının parçasıdır: değiştiklerinde liste
 * baştan, ilk sayfadan kurulur.
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
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await getShowEpisodes.execute({
          feedUrl,
          limit: PAGE_SIZE,
          cursor: pageParam,
          search,
          sort,
        }),
      ),
    getNextPageParam: lastPage => lastPage.episodes.nextCursor,
  });
};
