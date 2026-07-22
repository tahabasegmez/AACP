/**
 * TanStack Query anahtarları — tek yerden yönetilir ki cache invalidation tutarlı olsun.
 */
export const queryKeys = {
  shows: ['shows'] as const,
  feed: (feedUrl: string) => ['feed', feedUrl] as const,
};
