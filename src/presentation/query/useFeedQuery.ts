import { unwrap } from '@core/error';
import { useQuery } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/**
 * useFeedQuery — bir şovun feed'ini (şov + bölümler) getiren hook.
 */
export const useFeedQuery = (feedUrl: string | undefined) => {
  const { getPodcastFeed } = useDependencies();
  return useQuery({
    queryKey: queryKeys.feed(feedUrl ?? ''),
    enabled: Boolean(feedUrl),
    queryFn: async () => unwrap(await getPodcastFeed.execute({ feedUrl })),
  });
};
