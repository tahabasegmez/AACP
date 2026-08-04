import { Result } from '@core/error';
import { Episode, Playlist } from '../entities';

/** Yeni liste oluştururken verilen alanlar. */
export interface CreatePlaylistInput {
  readonly name: string;
  readonly description?: string;
  readonly coverUri?: string;
}

/**
 * Liste güncellemesi — verilmeyen alanlar değişmez.
 *
 * Bir alanı TEMİZLEMEK için boş metin gönderilir; `undefined` "dokunma"
 * anlamına gelir. İkisini ayırmadan, açıklamayı silmek imkânsız olurdu.
 */
export interface UpdatePlaylistInput {
  readonly name?: string;
  readonly description?: string;
  readonly coverUri?: string;
}

/**
 * PlaylistRepository — kullanıcı listelerinin kalıcılık PORTU.
 *
 * Bugün cihazda (KeyValueStorage) tutulur; kullanıcı hesabı devreye girdiğinde
 * aynı port sunucu destekli bir implementasyonla değiştirilebilir — domain ve
 * UI etkilenmez.
 *
 * "Sonra dinle" de bir listedir (sistem listesi) ve bu port üzerinden yönetilir;
 * böylece uygulamada tek bir liste kavramı olur.
 */
export interface PlaylistRepository {
  /** Tüm listeler — sistem listesi dahil. */
  list(): Promise<Result<readonly Playlist[]>>;
  get(playlistId: string): Promise<Result<Playlist | null>>;

  create(input: CreatePlaylistInput): Promise<Result<Playlist>>;
  update(playlistId: string, input: UpdatePlaylistInput): Promise<Result<Playlist>>;
  /** Sistem listeleri silinemez (hata döner). */
  remove(playlistId: string): Promise<Result<void>>;

  addEpisode(playlistId: string, episode: Episode): Promise<Result<Playlist>>;
  removeEpisode(playlistId: string, episodeId: string): Promise<Result<Playlist>>;
}
