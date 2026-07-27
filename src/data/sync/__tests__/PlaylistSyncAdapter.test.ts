import { InMemoryKeyValueStorage } from '@infrastructure';
import { Playlist, SAVED_PLAYLIST_ID } from '@domain/entities';
import { PlaylistSyncAdapter } from '../PlaylistSyncAdapter';

const PLAYLISTS_KEY = 'playlists_v1';

const playlist = (id: string, updatedAt: number, overrides?: Partial<Playlist>): Playlist => ({
  id,
  name: `Liste ${id}`,
  episodes: [],
  createdAt: updatedAt,
  updatedAt,
  ...overrides,
});

const make = () => {
  const storage = new InMemoryKeyValueStorage();
  return { storage, adapter: new PlaylistSyncAdapter(storage) };
};

const writePlaylists = (
  storage: InMemoryKeyValueStorage,
  playlists: readonly Playlist[],
): void => storage.set(PLAYLISTS_KEY, JSON.stringify(playlists));

const readPlaylists = (storage: InMemoryKeyValueStorage): Playlist[] =>
  JSON.parse(storage.getString(PLAYLISTS_KEY) ?? '[]') as Playlist[];

describe('PlaylistSyncAdapter', () => {
  it('verilen zamandan sonra değişen listeleri bildirir', async () => {
    const { storage, adapter } = make();
    writePlaylists(storage, [playlist('a', 100), playlist('b', 300)]);

    const changes = await adapter.localChanges(200);
    expect(changes.map(c => c.key)).toEqual(['b']);
  });

  it('silinen listeyi tombstone olarak bildirir', async () => {
    const { adapter } = make();
    adapter.markDeleted('silinen', 500);

    const changes = await adapter.localChanges(100);
    expect(changes).toEqual([
      { key: 'silinen', value: '', updatedAt: 500, deleted: true },
    ]);
  });

  it('uzaktan gelen yeni listeyi uygular', async () => {
    const { storage, adapter } = make();
    const remote = playlist('yeni', 500);

    await adapter.applyRemote([
      { key: 'yeni', value: JSON.stringify(remote), updatedAt: 500, deleted: false },
    ]);

    expect(readPlaylists(storage).map(p => p.id)).toEqual(['yeni']);
  });

  it('YEREL kayıt daha yeniyse uzak veriyi yok sayar (son yazan kazanır)', async () => {
    const { storage, adapter } = make();
    writePlaylists(storage, [playlist('a', 900, { name: 'Yerel ad' })]);

    await adapter.applyRemote([
      {
        key: 'a',
        value: JSON.stringify(playlist('a', 500, { name: 'Uzak ad' })),
        updatedAt: 500,
        deleted: false,
      },
    ]);

    expect(readPlaylists(storage)[0].name).toBe('Yerel ad');
  });

  it('uzak kayıt daha yeniyse yereli günceller', async () => {
    const { storage, adapter } = make();
    writePlaylists(storage, [playlist('a', 100, { name: 'Eski' })]);

    await adapter.applyRemote([
      {
        key: 'a',
        value: JSON.stringify(playlist('a', 900, { name: 'Yeni' })),
        updatedAt: 900,
        deleted: false,
      },
    ]);

    expect(readPlaylists(storage)[0].name).toBe('Yeni');
  });

  it('uzaktan silme yereli siler', async () => {
    const { storage, adapter } = make();
    writePlaylists(storage, [playlist('a', 100)]);

    await adapter.applyRemote([{ key: 'a', value: '', updatedAt: 900, deleted: true }]);

    expect(readPlaylists(storage)).toHaveLength(0);
  });

  it('SİSTEM listesi ("Sonra dinle") uzaktan SİLİNEMEZ', async () => {
    const { storage, adapter } = make();
    writePlaylists(storage, [playlist(SAVED_PLAYLIST_ID, 100, { system: true })]);

    await adapter.applyRemote([
      { key: SAVED_PLAYLIST_ID, value: '', updatedAt: 900, deleted: true },
    ]);

    expect(readPlaylists(storage).map(p => p.id)).toEqual([SAVED_PLAYLIST_ID]);
  });

  it('bozuk uzak veriyi atlar', async () => {
    const { storage, adapter } = make();
    await adapter.applyRemote([
      { key: 'bozuk', value: '{kirik', updatedAt: 900, deleted: false },
    ]);
    expect(readPlaylists(storage)).toHaveLength(0);
  });
});
