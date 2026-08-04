import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import {
  Episode,
  PLAYLIST_DESCRIPTION_MAX,
  PLAYLIST_NAME_MAX,
  Playlist,
  SAVED_PLAYLIST_ID,
  addEpisodeToPlaylist,
  normalizePlaylistText,
  removeEpisodeFromPlaylist,
} from '@domain/entities';
import { CreatePlaylistInput, PlaylistRepository, UpdatePlaylistInput } from '@domain/repositories';

const STORAGE_KEY = 'playlists_v1';
/** "Sonra dinle"nin eski (liste öncesi) deposu — bir kereliğine taşınır. */
const LEGACY_SAVED_KEY = 'saved_episodes_v1';

/** Sistem listesinin varsayılan hâli. */
const emptySavedPlaylist = (nowMs: number): Playlist => ({
  id: SAVED_PLAYLIST_ID,
  name: 'Sonra dinle',
  episodes: [],
  createdAt: nowMs,
  updatedAt: nowMs,
  system: true,
});

/**
 * PlaylistRepository'nin yerel implementasyonu (KeyValueStorage → MMKV).
 *
 * Tüm listeler tek bir JSON haritada tutulur. "Sonra dinle" burada bir SİSTEM
 * listesi olarak yaşar ve her zaman vardır (yoksa oluşturulur) — böylece
 * uygulamada tek bir liste kavramı olur.
 *
 * GÖÇ: Önceki sürüm "sonra dinle"yi ayrı bir anahtarda (`saved_episodes_v1`)
 * tutuyordu. İlk okumada o veri varsa sistem listesine taşınır; kullanıcı
 * verisi kaybolmaz.
 */
export class PlaylistRepositoryImpl implements PlaylistRepository {
  constructor(
    private readonly storage: KeyValueStorage,
    private readonly now: () => number = () => Date.now(),
    /**
     * Silmeleri senkrona bildirmek için. Verilmezse (sunucusuz kurulum)
     * silme yalnızca yerelde kalır — davranış bozulmaz.
     */
    private readonly onDeleted?: (playlistId: string, nowMs: number) => void,
  ) {}

  async list(): Promise<Result<readonly Playlist[]>> {
    try {
      return ok(this.readAll());
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async get(playlistId: string): Promise<Result<Playlist | null>> {
    try {
      return ok(this.readAll().find(p => p.id === playlistId) ?? null);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async create(input: CreatePlaylistInput): Promise<Result<Playlist>> {
    try {
      const name = input.name.trim();
      if (!name) {
        return fail(AppError.validation('Liste adı boş olamaz'));
      }
      const nowMs = this.now();
      const playlist: Playlist = {
        // Kimlik yerel olarak üretilir; sunucu senkronu geldiğinde de kararlı kalır.
        id: `pl_${nowMs.toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: name.slice(0, PLAYLIST_NAME_MAX),
        description: normalizePlaylistText(input.description, PLAYLIST_DESCRIPTION_MAX),
        coverUri: input.coverUri,
        episodes: [],
        createdAt: nowMs,
        updatedAt: nowMs,
      };
      this.writeAll([...this.readAll(), playlist]);
      return ok(playlist);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async update(playlistId: string, input: UpdatePlaylistInput): Promise<Result<Playlist>> {
    return this.mutate(playlistId, playlist => {
      // Açıklama ve kapak, verildiyse yazılır; `undefined` "dokunma" demektir.
      // Boş metin gönderilmesi alanı TEMİZLER.
      const patched = {
        ...playlist,
        description:
          input.description === undefined
            ? playlist.description
            : normalizePlaylistText(input.description, PLAYLIST_DESCRIPTION_MAX),
        coverUri: input.coverUri !== undefined ? input.coverUri : playlist.coverUri,
        updatedAt: this.now(),
      };

      // Sistem listesinin adı sabittir; diğer alanları değiştirilebilir.
      if (playlist.system) {
        return patched;
      }
      const name = input.name?.trim().slice(0, PLAYLIST_NAME_MAX);
      return { ...patched, name: name && name.length > 0 ? name : playlist.name };
    });
  }

  async remove(playlistId: string): Promise<Result<void>> {
    try {
      const all = this.readAll();
      const target = all.find(p => p.id === playlistId);
      if (!target) {
        return fail(AppError.notFound('Liste bulunamadı'));
      }
      if (target.system) {
        return fail(AppError.validation('Bu liste silinemez'));
      }
      this.writeAll(all.filter(p => p.id !== playlistId));
      // Silme senkrona bildirilir; aksi halde diğer cihazda liste geri gelirdi.
      this.onDeleted?.(playlistId, this.now());
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async addEpisode(playlistId: string, episode: Episode): Promise<Result<Playlist>> {
    return this.mutate(playlistId, playlist => addEpisodeToPlaylist(playlist, episode, this.now()));
  }

  async removeEpisode(playlistId: string, episodeId: string): Promise<Result<Playlist>> {
    return this.mutate(playlistId, playlist =>
      removeEpisodeFromPlaylist(playlist, episodeId, this.now()),
    );
  }

  /** Tek bir listeyi dönüştürüp kaydeder. */
  private mutate(
    playlistId: string,
    transform: (playlist: Playlist) => Playlist,
  ): Result<Playlist> {
    try {
      const all = this.readAll();
      const index = all.findIndex(p => p.id === playlistId);
      if (index < 0) {
        return fail(AppError.notFound('Liste bulunamadı'));
      }
      const next = transform(all[index]);
      const updated = [...all];
      updated[index] = next;
      this.writeAll(updated);
      return ok(next);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  /**
   * Tüm listeleri okur; sistem listesinin varlığını garanti eder ve gerekiyorsa
   * eski "sonra dinle" verisini bir kereliğine taşır.
   */
  private readAll(): Playlist[] {
    const raw = this.storage.getString(STORAGE_KEY);
    let playlists: Playlist[] = [];

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as unknown;
        playlists = Array.isArray(parsed) ? (parsed as Playlist[]) : [];
      } catch {
        playlists = []; // bozuk kayıt tüm listeleri düşürmesin
      }
    }

    if (!playlists.some(p => p.id === SAVED_PLAYLIST_ID)) {
      playlists = [this.migrateSaved(), ...playlists];
      this.writeAll(playlists);
    }
    return playlists;
  }

  /** Eski "sonra dinle" deposunu sistem listesine dönüştürür. */
  private migrateSaved(): Playlist {
    const base = emptySavedPlaylist(this.now());
    const legacy = this.storage.getString(LEGACY_SAVED_KEY);
    if (!legacy) {
      return base;
    }
    try {
      const parsed = JSON.parse(legacy) as unknown;
      if (Array.isArray(parsed)) {
        // Eski liste "en yeni önce" tutuluyordu; liste sırası korunur.
        return { ...base, episodes: parsed as Episode[] };
      }
    } catch {
      /* bozuk eski veri yok sayılır */
    }
    return base;
  }

  private writeAll(playlists: readonly Playlist[]): void {
    this.storage.set(STORAGE_KEY, JSON.stringify(playlists));
  }
}
