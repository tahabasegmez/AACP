import { KeyValueStorage } from '@core/ports';
import { silentLogger } from '../testLogger';
import { SyncEngine, SyncTransport } from '../SyncEngine';
import { FollowsSyncAdapter } from '../adapters';
import { ProgressSyncAdapter } from '../ProgressSyncAdapter';
import { SyncRecord } from '../SyncTypes';

class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>();
  getString(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  delete(key: string): void {
    this.map.delete(key);
  }
}

/** Sunucuyu taklit eden basit taşıma: gönderilenleri saklar, istenince döner. */
class FakeTransport implements SyncTransport {
  enabled = true;
  pushed: Record<string, SyncRecord[]> = {};
  remote: Record<string, SyncRecord[]> = {};

  async pull(collection: string, since: number) {
    const records = (this.remote[collection] ?? []).filter(r => r.updatedAt > since);
    return { records, cursor: records.reduce((m, r) => Math.max(m, r.updatedAt), since) };
  }

  async push(collection: string, records: readonly SyncRecord[]) {
    this.pushed[collection] = [...(this.pushed[collection] ?? []), ...records];
    return { cursor: records.reduce((m, r) => Math.max(m, r.updatedAt), 0) };
  }
}

const progressJson = (episodeId: string, updatedAt: string, positionSec = 10) =>
  JSON.stringify({
    episodeId,
    positionSec,
    durationSec: 100,
    updatedAt,
    completed: false,
  });

describe('SyncEngine', () => {
  it('yerel değişiklikleri sunucuya gönderir', async () => {
    const storage = new MemoryStorage();
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ ep1: JSON.parse(progressJson('ep1', '2026-01-01T00:00:00.000Z')) }),
    );
    const transport = new FakeTransport();
    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );

    await engine.syncAll();
    expect(transport.pushed.progress?.map(r => r.key)).toEqual(['ep1']);
  });

  it('sunucudaki daha yeni kaydı yerele uygular', async () => {
    const storage = new MemoryStorage();
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ ep1: JSON.parse(progressJson('ep1', '2026-01-01T00:00:00.000Z', 10)) }),
    );
    const transport = new FakeTransport();
    transport.remote.progress = [
      {
        key: 'ep1',
        value: progressJson('ep1', '2026-06-01T00:00:00.000Z', 90),
        updatedAt: new Date('2026-06-01T00:00:00.000Z').getTime(),
        deleted: false,
      },
    ];

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );
    await engine.syncAll();

    const stored = JSON.parse(storage.getString('playback_progress_v1') ?? '{}');
    expect(stored.ep1.positionSec).toBe(90);
  });

  it('yereldeki daha yeni kayıt uzak veriyle ezilmez', async () => {
    const storage = new MemoryStorage();
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ ep1: JSON.parse(progressJson('ep1', '2026-06-01T00:00:00.000Z', 90)) }),
    );
    const transport = new FakeTransport();
    transport.remote.progress = [
      {
        key: 'ep1',
        value: progressJson('ep1', '2026-01-01T00:00:00.000Z', 10),
        updatedAt: new Date('2026-01-01T00:00:00.000Z').getTime(),
        deleted: false,
      },
    ];

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );
    await engine.syncAll();

    const stored = JSON.parse(storage.getString('playback_progress_v1') ?? '{}');
    expect(stored.ep1.positionSec).toBe(90);
  });

  it('takip listesinde silme (tombstone) uzaktan uygulanır', async () => {
    const storage = new MemoryStorage();
    storage.set('followed_shows_v1', JSON.stringify(['show-a', 'show-b']));
    const transport = new FakeTransport();

    const adapter = new FollowsSyncAdapter(storage);
    const engine = new SyncEngine(transport, [adapter], storage, silentLogger);

    // İlk tur: mevcut üyeler sunucuya gider ve meta damgalanır.
    await engine.syncAll();
    expect(transport.pushed.follows?.map(r => r.key).sort()).toEqual(['show-a', 'show-b']);

    // Sunucuda show-a silinmiş olsun (gelecek damgayla).
    transport.remote.follows = [
      { key: 'show-a', value: '', updatedAt: Date.now() + 60_000, deleted: true },
    ];
    await engine.syncAll();

    expect(JSON.parse(storage.getString('followed_shows_v1') ?? '[]')).toEqual(['show-b']);
  });

  it('taşıma kapalıysa hiçbir şey yapmaz', async () => {
    const storage = new MemoryStorage();
    const transport = new FakeTransport();
    transport.enabled = false;

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );
    await engine.syncAll();
    expect(transport.pushed).toEqual({});
  });

  it('sunucu hatası uygulamayı bozmaz', async () => {
    const storage = new MemoryStorage();
    const transport = new FakeTransport();
    transport.pull = async () => {
      throw new Error('offline');
    };

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );
    // Hata FIRLATILMAZ: senkron en iyi çabadır, uygulama akışını bozmaz.
    // Durum "error" olarak raporlanır ki kullanıcıya gösterilebilsin.
    const status = await engine.syncAll();
    expect(status.phase).toBe('error');
    expect(status.error).toContain('offline');
  });

  it('başarılı senkron sonrası durumu success olarak yayınlar', async () => {
    const storage = new MemoryStorage();
    const engine = new SyncEngine(
      new FakeTransport(),
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );

    const phases: string[] = [];
    engine.subscribe(s => phases.push(s.phase));

    const status = await engine.syncAll();

    expect(status.phase).toBe('success');
    expect(status.lastSyncAt).toBeGreaterThan(0);
    expect(phases).toContain('syncing');
  });

  it('ÇAKIŞMALARI sayar — uzak kayıt yereldekinden daha yeniyse', async () => {
    const storage = new MemoryStorage();
    const transport = new FakeTransport();

    // Yerelde eski, sunucuda daha yeni bir kayıt (aynı bölüm).
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ 'ep-1': JSON.parse(progressJson('ep-1', '2026-07-01T00:00:00.000Z')) }),
    );
    transport.remote.progress = [
      {
        key: 'ep-1',
        value: progressJson('ep-1', '2026-07-20T00:00:00.000Z', 99),
        updatedAt: Date.parse('2026-07-20T00:00:00.000Z'),
        deleted: false,
      },
    ];

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );
    const status = await engine.syncAll();

    expect(status.conflictCount).toBe(1);
  });

  it('bekleyen değişiklikleri ağa çıkmadan sayar', async () => {
    const storage = new MemoryStorage();
    const transport = new FakeTransport();
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ 'ep-1': JSON.parse(progressJson('ep-1', '2026-07-01T00:00:00.000Z')) }),
    );

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );

    expect(await engine.countPending()).toBe(1);
    expect(transport.pushed.progress).toBeUndefined(); // ağa çıkılmadı
  });

  it('replaceWithRemote yerel veriyi siler ve sunucuya GÖNDERMEZ', async () => {
    const storage = new MemoryStorage();
    const transport = new FakeTransport();
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ 'ep-1': JSON.parse(progressJson('ep-1', '2026-07-01T00:00:00.000Z')) }),
    );

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );
    await engine.replaceWithRemote();

    // Önceki kimliğe ait veri yeni hesaba karışmamalı.
    expect(transport.pushed.progress).toBeUndefined();
    expect(storage.getString('playback_progress_v1')).toBeNull();
  });

  it('adoptLocalInto imleci sıfırlar — yerel veri yeni hesaba taşınır', async () => {
    const storage = new MemoryStorage();
    const transport = new FakeTransport();
    storage.set(
      'playback_progress_v1',
      JSON.stringify({ 'ep-1': JSON.parse(progressJson('ep-1', '2026-07-01T00:00:00.000Z')) }),
    );

    const engine = new SyncEngine(
      transport,
      [new ProgressSyncAdapter(storage)],
      storage,
      silentLogger,
    );

    await engine.syncAll();
    expect(transport.pushed.progress).toHaveLength(1);

    // Kimlik değişti: aynı veri yeni hesap adına yeniden gönderilir.
    await engine.adoptLocalInto();
    expect(transport.pushed.progress).toHaveLength(2);
    expect(storage.getString('playback_progress_v1')).not.toBeNull();
  });
});
