import { unwrap } from '@core/error';
import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/**
 * useShowsQuery — şov kataloğunu getiren React Query hook'u.
 *
 * Use case'i (GetShowCatalog) çağırır; Result'ı `unwrap` ile çözer, böylece
 * React Query hata/yükleniyor durumlarını yönetir. Ekran sadece bu hook'u kullanır.
 */
export const useShowsQuery = () => {
  const { getShowCatalog } = useDependencies();
  return useQuery({
    queryKey: queryKeys.shows,
    queryFn: async () => unwrap(await getShowCatalog.execute()),
  });
};
