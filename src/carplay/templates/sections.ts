import { formatDuration } from '@core/utils';
import { Episode, PlaybackProgress, Playlist, Show, playlistCoverUri } from '@domain/entities';

/**
 * CarPlay liste öğesi (minimal).
 *
 * `react-native-carplay`'in `ListItem` tipiyle yapısal olarak uyumludur ama
 * native tipe BAĞLANMAZ: böylece bu dönüşümler saf kalır ve CarPlay olmadan
 * (Windows dahil) test edilebilir.
 */
export interface CarPlayListItem {
  text: string;
  detailText?: string;
  /** Kapak görseli — RN image source biçiminde (`{ uri }`). */
  image?: { uri: string };
  /** O an çalan öğe mi (CarPlay bunu görsel olarak işaretler). */
  isPlaying?: boolean;
  /** Alt seviyeye gidiliyorsa ok işareti gösterilir. */
  showsDisclosureIndicator?: boolean;
}

/** Başlıklı satır grubu — CarPlay'in `ListSection` karşılığı. */
export interface CarPlaySection {
  header?: string;
  items: CarPlayListItem[];
}

/** Bir satıra dokunulduğunda çalışacak iş. */
export type CarPlayRowAction = () => void | Promise<void>;

/** Bölümler ve satır davranışları — `buildList` üretir. */
export interface CarPlayList {
  sections: CarPlaySection[];
  actions: readonly CarPlayRowAction[];
}

/** Tek bir grup: başlık + satırlar + satır başına davranış (aynı sırada). */
export interface CarPlayGroup {
  header?: string;
  items: CarPlayListItem[];
  actions: CarPlayRowAction[];
}

/**
 * Grupları tek bir listeye derler.
 *
 * CarPlay'in seçim olayı DÜZ bir index verir: ikinci bölümün ilk satırı,
 * birinci bölümün öğe sayısından devam eder. Bu yüzden davranışlar da aynı
 * düzlükte birleştirilir — bölümler ve davranışlar tek yerden üretilince
 * index kayması mümkün olmaz.
 *
 * Boş gruplar atlanır: araçta boş bir başlık yalnızca yer kaplar.
 */
export const buildList = (groups: readonly CarPlayGroup[]): CarPlayList => {
  const filled = groups.filter(group => group.items.length > 0);
  return {
    sections: filled.map(({ header, items }) => (header ? { header, items } : { items })),
    actions: filled.flatMap(group => group.actions),
  };
};

/** Uzak görseli CarPlay'in beklediği kaynağa çevirir; yoksa alan atlanır. */
const cover = (uri?: string): { uri: string } | undefined =>
  uri && uri.length > 0 ? { uri } : undefined;

/** Kalan süreyi insan diline çevirir ("12 dk kaldı"). */
const remainingText = (progress: PlaybackProgress): string => {
  const remaining = Math.max(0, progress.durationSec - progress.positionSec);
  return remaining > 0 ? `${formatDuration(remaining)} kaldı` : 'Neredeyse bitti';
};

/** Şovları CarPlay liste öğelerine çevirir (Kitaplığın sekmesi). */
export const showsToItems = (shows: readonly Show[]): CarPlayListItem[] =>
  shows.map(show => ({
    text: show.title,
    detailText: show.description || undefined,
    image: cover(show.imageUrl),
    showsDisclosureIndicator: true,
  }));

/**
 * Bölümleri CarPlay liste öğelerine çevirir.
 * `currentEpisodeId` verilirse çalan bölüm işaretlenir.
 */
export const episodesToItems = (
  episodes: readonly Episode[],
  currentEpisodeId?: string | null,
): CarPlayListItem[] =>
  episodes.map(episode => ({
    text: episode.title,
    detailText: formatDuration(episode.durationSec),
    image: cover(episode.imageUrl),
    isPlaying: !!currentEpisodeId && episode.id === currentEpisodeId,
  }));

/**
 * "Dinlemeye devam" kayıtlarını liste öğelerine çevirir.
 *
 * Süre yerine KALAN süre gösterilir: sürücü için "ne kadar kaldı" bilgisi
 * toplam süreden daha yararlıdır.
 */
export const resumeToItems = (
  items: readonly PlaybackProgress[],
  currentEpisodeId?: string | null,
): CarPlayListItem[] =>
  items.map(progress => ({
    text: progress.episodeTitle ?? 'Bölüm',
    detailText: remainingText(progress),
    image: cover(progress.artworkUrl),
    isPlaying: !!currentEpisodeId && progress.episodeId === currentEpisodeId,
  }));

/** Kullanıcı listelerini liste öğelerine çevirir. */
export const playlistsToItems = (playlists: readonly Playlist[]): CarPlayListItem[] =>
  playlists.map(playlist => ({
    text: playlist.name,
    detailText:
      playlist.episodes.length === 0
        ? 'Boş liste'
        : `${playlist.episodes.length} bölüm`,
    image: cover(playlistCoverUri(playlist)),
    showsDisclosureIndicator: true,
  }));
