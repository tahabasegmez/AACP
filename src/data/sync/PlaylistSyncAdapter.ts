import { KeyValueStorage } from '@core/ports';
import { Playlist } from '@domain/entities';
import { SyncCollectionAdapter, SyncRecord } from './SyncTypes';

/** PlaylistRepositoryImpl ile AYNI depo anahtarı olmalı. */
const PLAYLISTS_KEY = 'playlists_v1';
/**
 * "Sonra dinle"nin liste sistemi öncesi deposu.
 *
 * `PlaylistRepositoryImpl` bu anahtarı bir kereliğine göç için okur. Yerel veri
 * temizlenirken BU DA silinmelidir; aksi halde çıkış sonrası ilk okumada göç
 * tekrar çalışır ve önceki kullanıcının "Sonra dinle" listesi geri gelir.
 */
const LEGACY_SAVED_KEY = 'saved_episodes_v1';

/**
 * PlaylistSyncAdapter — kullanıcı listelerinin senkronu.
 *
 * Diğer koleksiyonlardan farkı: her liste ZATEN kendi `updatedAt` damgasını
 * taşır (Playlist entity'si bunun için tasarlandı), bu yüzden gölge meta
 * haritasına gerek yoktur. Silinen listeler için tombstone tutulur — aksi
 * halde bir cihazdaki silme diğerine ulaşmazdı.
 *
 * Anahtar = playlist id, değer = listenin tamamı (bölümleriyle). Listeler
 * küçük olduğu için tamamını taşımak, bölüm bazlı senkrondan hem basit hem
 * çakışmaya daha dayanıklıdır (son yazan kazanır).
 */
export class PlaylistSyncAdapter implements SyncCollectionAdapter {
  readonly collection = 'playlists' as const;

  constructor(private readonly storage: KeyValueStorage) {}

  private get tombstoneKey(): string {
    return 'aacp.sync.deleted.playlists';
  }

  async localChanges(since: number): Promise<readonly SyncRecord[]> {
    const playlists = this.readList();
    const records: SyncRecord[] = [];

    for (const playlist of playlists) {
      if (playlist.updatedAt > since) {
        records.push({
          key: playlist.id,
          value: JSON.stringify(playlist),
          updatedAt: playlist.updatedAt,
          deleted: false,
        });
      }
    }

    // Silinmiş listeler (tombstone).
    for (const [id, deletedAt] of Object.entries(this.readTombstones())) {
      if (deletedAt > since) {
        records.push({ key: id, value: '', updatedAt: deletedAt, deleted: true });
      }
    }

    return records;
  }

  async applyRemote(records: readonly SyncRecord[]): Promise<void> {
    const playlists = this.readList();
    const byId = new Map(playlists.map(p => [p.id, p]));
    const tombstones = this.readTombstones();
    let changed = false;

    for (const record of records) {
      const local = byId.get(record.key);
      const localAt = local?.updatedAt ?? tombstones[record.key] ?? 0;

      // Yerel kayıt daha yeniyse uzak veri yok sayılır (son yazan kazanır).
      if (record.updatedAt <= localAt) {
        continue;
      }

      if (record.deleted) {
        // Sistem listesi ("Sonra dinle") uzaktan silinemez; yalnızca içeriği
        // senkronlanır. Aksi halde bir cihazdaki hata listeyi yok ederdi.
        if (local?.system) {
          continue;
        }
        if (byId.delete(record.key)) {
          changed = true;
        }
        tombstones[record.key] = record.updatedAt;
        changed = true;
        continue;
      }

      const parsed = parsePlaylist(record.value);
      if (parsed) {
        byId.set(record.key, parsed);
        delete tombstones[record.key];
        changed = true;
      }
    }

    if (changed) {
      this.writeList([...byId.values()]);
      this.writeTombstones(tombstones);
    }
  }

  async clearLocal(): Promise<void> {
    // Listeler ve silme kayıtları birlikte temizlenir; sistem listesi
    // ("Sonra dinle") bir sonraki okumada BOŞ olarak yeniden oluşturulur.
    this.storage.delete(PLAYLISTS_KEY);
    this.storage.delete(this.tombstoneKey);
    // Göç kaynağı da silinir — yoksa önceki kullanıcının "Sonra dinle"si
    // bir sonraki okumada göç yoluyla geri gelirdi.
    this.storage.delete(LEGACY_SAVED_KEY);
  }

  /** Bir liste silindiğinde çağrılır — senkron için tombstone bırakır. */
  markDeleted(playlistId: string, nowMs: number = Date.now()): void {
    const tombstones = this.readTombstones();
    tombstones[playlistId] = nowMs;
    this.writeTombstones(tombstones);
  }

  private readList(): Playlist[] {
    const raw = this.storage.getString(PLAYLISTS_KEY);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as Playlist[]) : [];
    } catch {
      return [];
    }
  }

  private writeList(playlists: readonly Playlist[]): void {
    this.storage.set(PLAYLISTS_KEY, JSON.stringify(playlists));
  }

  private readTombstones(): Record<string, number> {
    const raw = this.storage.getString(this.tombstoneKey);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, number>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeTombstones(tombstones: Record<string, number>): void {
    this.storage.set(this.tombstoneKey, JSON.stringify(tombstones));
  }
}

/** Uzak yükü doğrulayarak listeye çevirir; bozuksa null. */
const parsePlaylist = (json: string): Playlist | null => {
  try {
    const parsed = JSON.parse(json) as Playlist;
    if (
      parsed &&
      typeof parsed.id === 'string' &&
      typeof parsed.name === 'string' &&
      Array.isArray(parsed.episodes)
    ) {
      return parsed;
    }
  } catch {
    /* bozuk kayıt atlanır */
  }
  return null;
};
