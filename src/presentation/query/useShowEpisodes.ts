import { unwrap } from '@core/error';
import { EpisodeSortOrder } from '@domain/entities';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
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
    // Arama/sıralama değişince sorgu anahtarı da değişir ve liste normalde
    // "ilk yükleme" durumuna düşerdi: kullanıcı her harfte içeriğin yerine
    // yükleme göstergesi görürdü. Önceki sonuçlar yenisi gelene kadar ekranda
    // KALIR; böylece yazarken liste yerinde durur, sessizce tazelenir.
    placeholderData: keepPreviousData,
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
