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
  /**
   * Kapak görselinin adresi.
   *
   * `image` alanı BİLİNÇLİ olarak kullanılmaz: onu native taraf RN'in
   * `RCTConvert UIImage` yolundan geçirir ve o yol uzak adresi reddedip
   * `file://` adresinde çökebiliyor (bkz. docs/CARPLAY.md). `imgUrl` görseli
   * doğrudan okur; buraya DAİMA yerel bir dosya adresi verilir.
   */
  imgUrl?: string;
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

/** Bölümlerdeki benzersiz kapak adresleri — önceden indirmek için. */
export const imageUrls = (sections: readonly CarPlaySection[]): string[] => [
  ...new Set(
    sections.flatMap(section =>
      section.items.map(item => item.imgUrl).filter((uri): uri is string => !!uri),
    ),
  ),
];

/**
 * Uzak kapak adreslerini yerel dosya adresleriyle değiştirir.
 *
 * CarPlay'e uzak adres VERİLMEZ (bkz. `CarPlayListItem.imgUrl`). Haritada
 * karşılığı olmayan — yani henüz indirilememiş — kapaklar tümüyle düşürülür;
 * satır kapaksız görünür, liste çalışmaya devam eder.
 */
export const withLocalImages = (
  sections: readonly CarPlaySection[],
  local: ReadonlyMap<string, string>,
): CarPlaySection[] =>
  sections.map(section => ({
    ...section,
    items: section.items.map(item => {
      const resolved = item.imgUrl ? local.get(item.imgUrl) : undefined;
      if (resolved) {
        return { ...item, imgUrl: resolved };
      }
      const copy = { ...item };
      delete copy.imgUrl;
      return copy;
    }),
  }));

/**
 * Bölümleri kapaksız kopyalar.
 *
 * Görsel çizimi beklenmedik bir sebeple patlarsa araçta BOŞ liste göstermek
 * yerine kapaksız göstermek yeğdir — bu yüzden yedek düzen olarak kullanılır.
 */
export const withoutImages = (sections: readonly CarPlaySection[]): CarPlaySection[] =>
  sections.map(section => ({
    ...section,
    items: section.items.map(item => {
      const copy = { ...item };
      delete copy.imgUrl;
      return copy;
    }),
  }));

/** Boş adresleri eler; dolu olanlar sonradan yerel adresle değiştirilir. */
const cover = (uri?: string): string | undefined =>
  uri && uri.length > 0 ? uri : undefined;

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
    imgUrl: cover(show.imageUrl),
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
    imgUrl: cover(episode.imageUrl),
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
    imgUrl: cover(progress.artworkUrl),
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
    imgUrl: cover(playlistCoverUri(playlist)),
    showsDisclosureIndicator: true,
  }));
