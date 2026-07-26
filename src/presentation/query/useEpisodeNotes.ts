import { useMemo } from 'react';
import { Episode } from '@domain/entities';
import { useShowsQuery } from './useShowsQuery';
import { useShowEpisodes } from './useShowEpisodes';

/**
 * useEpisodeNotes — bir bölümün notlarını (açıklama) güvenilir biçimde döndürür.
 *
 * "Dinlemeye devam" gibi hafif kayıtlardan üretilen bölümlerde `description`
 * boş olur (feed çekmemek için meta sınırlı tutulur). Bu durumda şovun feed'i
 * (zaten cache'li) üzerinden eşleşen bölümün açıklaması bulunur. Böylece notlar
 * kaynak ne olursa olsun Player/Sheet'te görünür. Bölümde açıklama zaten varsa
 * ek sorgu yapılmaz.
 */
export const useEpisodeNotes = (episode?: Episode): string => {
  const hasOwn = !!episode?.description;

  const shows = useShowsQuery();
  const feedUrl = useMemo(
    () => shows.data?.find(s => s.id === episode?.showId)?.feedUrl,
    [shows.data, episode?.showId],
  );

  // Yalnızca açıklama eksikse ve feed biliniyorsa sorgu etkinleşir.
  const q = useShowEpisodes(hasOwn ? undefined : feedUrl);

  const fetched = useMemo(() => {
    if (hasOwn || !episode) {
      return undefined;
    }
    return q.data?.pages
      .flatMap(p => p.episodes.items)
      .find(e => e.id === episode.id)?.description;
  }, [hasOwn, episode, q.data]);

  return episode?.description || fetched || '';
};
