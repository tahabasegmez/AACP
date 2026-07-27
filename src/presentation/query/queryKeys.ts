import { EpisodeSortOrder } from '@domain/entities';

/**
 * TanStack Query anahtarları — tek yerden yönetilir ki cache invalidation tutarlı olsun.
 */
export const queryKeys = {
  shows: ['shows'] as const,
  feed: (feedUrl: string) => ['feed', feedUrl] as const,
  showEpisodes: (feedUrl: string, search: string, sort: EpisodeSortOrder) =>
    ['showEpisodes', feedUrl, search, sort] as const,
  resume: ['resume'] as const,
  followedShows: ['followedShows'] as const,
  saved: ['saved'] as const,
  playlists: ['playlists'] as const,
  currentUser: ['currentUser'] as const,
  isFollowed: (showId: string) => ['isFollowed', showId] as const,
  latestEpisodes: (feedUrls: readonly string[]) =>
    ['latestEpisodes', [...feedUrls].sort().join(',')] as const,
};
