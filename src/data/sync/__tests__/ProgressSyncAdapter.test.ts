import { InMemoryKeyValueStorage } from '@infrastructure';
import { PlaybackProgress } from '@domain/entities';
import { ProgressSyncAdapter } from '../ProgressSyncAdapter';

const STORAGE_KEY = 'playback_progress_v1';

const progress = (episodeId: string, updatedAt: string, positionSec = 100): PlaybackProgress => ({
  episodeId,
  positionSec,
  durationSec: 600,
  updatedAt,
  completed: false,
});

const readAll = (storage: InMemoryKeyValueStorage): Record<string, PlaybackProgress> =>
  JSON.parse(storage.getString(STORAGE_KEY) ?? '{}');

describe('ProgressSyncAdapter', () => {
  it('uzak kaydı BÖLÜM kimliğiyle anahtarlar', async () => {
    const storage = new InMemoryKeyValueStorage();
    const adapter = new ProgressSyncAdapter(storage);

    // Sunucudan eski/farklı bir anahtarla gelen kayıt.
    await adapter.applyRemote([
      {
        key: 'legacy:ep1',
        value: JSON.stringify(progress('ep1', '2026-07-21T10:00:00.000Z', 300)),
        updatedAt: Date.parse('2026-07-21T10:00:00.000Z'),
        deleted: false,
      },
    ]);

    // Aynı bölüm için iki giriş oluşmaz; anahtar bölüm kimliğidir.
    expect(Object.keys(readAll(storage))).toEqual(['ep1']);
    expect(readAll(storage).ep1.positionSec).toBe(300);
  });

  it('yerelde daha yeni kayıt varsa uzak veriyi yok sayar', async () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set(
      STORAGE_KEY,
      JSON.stringify({ ep1: progress('ep1', '2026-07-22T10:00:00.000Z', 500) }),
    );
    const adapter = new ProgressSyncAdapter(storage);

    await adapter.applyRemote([
      {
        key: 'ep1',
        value: JSON.stringify(progress('ep1', '2026-07-21T10:00:00.000Z', 100)),
        updatedAt: Date.parse('2026-07-21T10:00:00.000Z'),
        deleted: false,
      },
    ]);

    expect(readAll(storage).ep1.positionSec).toBe(500);
  });

  it('tombstone kaydı yerelden siler', async () => {
    const storage = new InMemoryKeyValueStorage();
    storage.set(
      STORAGE_KEY,
      JSON.stringify({ ep1: progress('ep1', '2026-07-20T10:00:00.000Z') }),
    );
    const adapter = new ProgressSyncAdapter(storage);

    await adapter.applyRemote([
      {
        key: 'ep1',
        value: '',
        updatedAt: Date.parse('2026-07-21T10:00:00.000Z'),
        deleted: true,
      },
    ]);

    expect(readAll(storage)).toEqual({});
  });

  it('bozuk uzak kayıt yerel depoyu kirletmez', async () => {
    const storage = new InMemoryKeyValueStorage();
    const adapter = new ProgressSyncAdapter(storage);

    await adapter.applyRemote([
      { key: 'ep1', value: '{bozuk', updatedAt: 1, deleted: false },
    ]);

    expect(readAll(storage)).toEqual({});
  });
});
