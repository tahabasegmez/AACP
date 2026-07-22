import { formatDuration } from '@core/utils';
import { Episode, Show } from '@domain/entities';

/**
 * CarPlay liste öğesi (minimal). react-native-carplay'in ListItem tipiyle
 * yapısal olarak uyumludur; native tipe bağlanmadan saf/test edilebilir kalır.
 */
export interface CarPlayListItem {
  text: string;
  detailText?: string;
}

/** Şovları CarPlay liste öğelerine çevirir (saf). */
export const showsToItems = (shows: readonly Show[]): CarPlayListItem[] =>
  shows.map(show => ({
    text: show.title,
    detailText: show.description || undefined,
  }));

/** Bölümleri CarPlay liste öğelerine çevirir; süreyi alt metinde gösterir (saf). */
export const episodesToItems = (
  episodes: readonly Episode[],
): CarPlayListItem[] =>
  episodes.map(episode => ({
    text: episode.title,
    detailText: formatDuration(episode.durationSec),
  }));
