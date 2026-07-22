import { Episode } from './Episode';

/**
 * Bölüm listesi üzerinde saf sorgu/dönüşüm yardımcıları (arama, sıralama).
 * Platform bağımsız, test edilebilir. UI ve CarPlay ortak kullanır.
 */

export type EpisodeSortOrder = 'newest' | 'oldest';

/** Türkçe-duyarlı küçük harfe çevirme (İ/ı doğru ele alınsın). */
const trLower = (value: string): string => value.toLocaleLowerCase('tr-TR');

/**
 * Bölümleri yayın tarihine göre sıralar (yeni kopyayı döner, girdiyi bozmaz).
 * Geçersiz/boş tarihler en sona atılır.
 */
export const sortEpisodes = (
  episodes: readonly Episode[],
  order: EpisodeSortOrder = 'newest',
): Episode[] => {
  const withTime = episodes.map(ep => ({
    ep,
    time: ep.publishedAt ? new Date(ep.publishedAt).getTime() : NaN,
  }));
  withTime.sort((a, b) => {
    const aInvalid = Number.isNaN(a.time);
    const bInvalid = Number.isNaN(b.time);
    if (aInvalid && bInvalid) return 0;
    if (aInvalid) return 1; // geçersiz sona
    if (bInvalid) return -1;
    return order === 'newest' ? b.time - a.time : a.time - b.time;
  });
  return withTime.map(x => x.ep);
};

/**
 * Başlık ve açıklamada (Türkçe-duyarlı) arama yapar. Boş sorgu tüm listeyi döner.
 */
export const searchEpisodes = (
  episodes: readonly Episode[],
  query: string,
): Episode[] => {
  const q = trLower(query.trim());
  if (!q) {
    return [...episodes];
  }
  return episodes.filter(
    ep => trLower(ep.title).includes(q) || trLower(ep.description).includes(q),
  );
};
