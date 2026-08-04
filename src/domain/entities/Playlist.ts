import { Episode } from './Episode';

/**
 * Playlist — kullanıcının kendi oluşturduğu bölüm listesi.
 *
 * "Sonra dinle" de özünde bir listedir ama uygulamanın her yerinde erişilen
 * SABİT bir listedir (silinemez, yeniden adlandırılamaz). Bu ayrımı `system`
 * bayrağı taşır: sistem listeleri kullanıcı tarafından silinemez/düzenlenemez
 * ama içerik ekleme/çıkarma aynı şekilde çalışır. Böylece iki ayrı kavram
 * yerine tek bir model ve tek bir ekran/kart bileşeni yeterli olur.
 *
 * `coverUri` kullanıcının seçtiği kapak görselidir; yoksa listenin ilk
 * bölümlerinin kapaklarından türetilen bir görünüm kullanılır.
 */
export interface Playlist {
  readonly id: string;
  readonly name: string;
  /** Kullanıcının yazdığı serbest açıklama (opsiyonel). */
  readonly description?: string;
  /** Kullanıcının seçtiği kapak (yerel dosya ya da uzak adres). */
  readonly coverUri?: string;
  /** Listedeki bölümler — sıralama kullanıcının eklediği sıradır. */
  readonly episodes: readonly Episode[];
  /** Oluşturma zamanı (epoch ms) — sıralama için. */
  readonly createdAt: number;
  /** Son değişiklik zamanı (epoch ms) — senkron ve sıralama için. */
  readonly updatedAt: number;
  /**
   * Sistem listesi mi? (ör. "Sonra dinle") Sistem listeleri silinemez ve
   * yeniden adlandırılamaz.
   */
  readonly system?: boolean;
}

/** "Sonra dinle" listesinin sabit kimliği — uygulamanın her yerinde aynı. */
export const SAVED_PLAYLIST_ID = 'saved';

/**
 * Ad ve açıklama için üst sınırlar.
 *
 * Domain'de durur ki hem giriş alanı hem depo AYNI kuralı uygulasın: sınırı
 * yalnızca arayüzde tutmak, senkronla gelen bir kaydın sınırsız uzun olmasına
 * izin vermek demekti.
 */
export const PLAYLIST_NAME_MAX = 60;
export const PLAYLIST_DESCRIPTION_MAX = 300;

/** Serbest metni kırpar ve boşsa alanı hiç yazmaz. */
export const normalizePlaylistText = (
  value: string | undefined,
  max: number,
): string | undefined => {
  const trimmed = value?.trim().slice(0, max);
  return trimmed ? trimmed : undefined;
};

/** Bir bölüm listede var mı? */
export const playlistHasEpisode = (playlist: Playlist, episodeId: string): boolean =>
  playlist.episodes.some(e => e.id === episodeId);

/**
 * Bölümü listeye ekler. Zaten varsa liste DEĞİŞMEDEN döner — çağıranın önce
 * `playlistHasEpisode` ile kontrol edip kullanıcıya sorması beklenir.
 */
export const addEpisodeToPlaylist = (
  playlist: Playlist,
  episode: Episode,
  nowMs: number,
): Playlist =>
  playlistHasEpisode(playlist, episode.id)
    ? playlist
    : { ...playlist, episodes: [...playlist.episodes, episode], updatedAt: nowMs };

/** Bölümü listeden çıkarır. */
export const removeEpisodeFromPlaylist = (
  playlist: Playlist,
  episodeId: string,
  nowMs: number,
): Playlist => ({
  ...playlist,
  episodes: playlist.episodes.filter(e => e.id !== episodeId),
  updatedAt: nowMs,
});

/** Listenin toplam süresi (saniye) — kart alt bilgisi için. */
export const playlistDurationSec = (playlist: Playlist): number =>
  playlist.episodes.reduce((total, e) => total + (e.durationSec || 0), 0);

/** Kapak yoksa ilk bölümün görselini kullan (Spotify davranışı). */
export const playlistCoverUri = (playlist: Playlist): string | undefined =>
  playlist.coverUri ?? playlist.episodes[0]?.imageUrl;
