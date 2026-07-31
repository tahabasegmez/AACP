import { describe, expect, it } from 'vitest';
import { KvSyncStore, type KvNamespace } from '../storage/KvSyncStore';
import { resolveStore, storagePlacement } from '../storage/resolveStore';
import { PostgresSyncStore } from '../storage/PostgresSyncStore';
import type { Env } from '../env';

/** Bellek içi KV — Cloudflare KV'nin kullandığımız yüzeyini taklit eder. */
class FakeKv implements KvNamespace {
  readonly store = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async list(options: { prefix: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
  }> {
    return {
      keys: [...this.store.keys()]
        .filter(name => name.startsWith(options.prefix))
        .map(name => ({ name })),
      list_complete: true,
    };
  }
}

const scope = { userId: 'u1', accessToken: 't1' };
const other = { userId: 'u2', accessToken: 't2' };

describe('KvSyncStore', () => {
  it('yazılan kaydı delta olarak geri verir', async () => {
    const store = new KvSyncStore(new FakeKv());

    await store.put(scope, 'progress', [
      { key: 'ep1', value: '{"p":10}', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records).toEqual([
      { key: 'ep1', value: '{"p":10}', updatedAt: 100, deleted: false },
    ]);
  });

  it('imleçten eski kayıtları döndürmez', async () => {
    const store = new KvSyncStore(new FakeKv());
    await store.put(scope, 'progress', [
      { key: 'ep1', value: 'a', updatedAt: 100, deleted: false },
    ]);

    expect(await store.changesSince(scope, 'progress', 100, 50)).toEqual([]);
  });

  it('SON YAZAN KAZANIR: eski kayıt yeniyi ezmez', async () => {
    const store = new KvSyncStore(new FakeKv());
    await store.put(scope, 'progress', [
      { key: 'ep1', value: 'yeni', updatedAt: 200, deleted: false },
    ]);

    await store.put(scope, 'progress', [
      { key: 'ep1', value: 'eski', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records[0].value).toBe('yeni');
  });

  it('kullanıcılar birbirinin kayıtlarını GÖREMEZ', async () => {
    const kv = new FakeKv();
    const store = new KvSyncStore(kv);
    await store.put(scope, 'progress', [
      { key: 'ep1', value: 'gizli', updatedAt: 100, deleted: false },
    ]);

    expect(await store.changesSince(other, 'progress', 0, 50)).toEqual([]);
  });

  it('koleksiyonlar birbirine karışmaz', async () => {
    const store = new KvSyncStore(new FakeKv());
    await store.put(scope, 'progress', [
      { key: 'k', value: 'p', updatedAt: 100, deleted: false },
    ]);

    expect(await store.changesSince(scope, 'preferences', 0, 50)).toEqual([]);
  });

  it('silme (tombstone) taşınır', async () => {
    const store = new KvSyncStore(new FakeKv());
    await store.put(scope, 'preferences', [
      { key: 'x', value: '', updatedAt: 100, deleted: true },
    ]);

    const records = await store.changesSince(scope, 'preferences', 0, 50);
    expect(records[0].deleted).toBe(true);
  });

  it('bozuk kayıt tüm senkronu düşürmez', async () => {
    const kv = new FakeKv();
    kv.store.set('progress:u1:bozuk', '{yok');
    const store = new KvSyncStore(kv);
    await store.put(scope, 'progress', [
      { key: 'saglam', value: 'v', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records.map(r => r.key)).toEqual(['saglam']);
  });

  it('sonuçlar zamana göre artan sırada gelir', async () => {
    const store = new KvSyncStore(new FakeKv());
    await store.put(scope, 'progress', [
      { key: 'b', value: 'v', updatedAt: 200, deleted: false },
      { key: 'a', value: 'v', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records.map(r => r.key)).toEqual(['a', 'b']);
  });
});

describe('resolveStore', () => {
  const withKv = { USER_STATE: new FakeKv() } as unknown as Env;
  const withoutKv = {} as Env;

  it('yüksek hacimli koleksiyonlar NoSQL tarafına gider', () => {
    expect(resolveStore(withKv, 'progress')).toBeInstanceOf(KvSyncStore);
    expect(resolveStore(withKv, 'preferences')).toBeInstanceOf(KvSyncStore);
  });

  it('sorgulanan kütüphane verisi ilişkisel tarafta kalır', () => {
    expect(resolveStore(withKv, 'follows')).toBeInstanceOf(PostgresSyncStore);
    expect(resolveStore(withKv, 'playlists')).toBeInstanceOf(PostgresSyncStore);
    expect(resolveStore(withKv, 'saved')).toBeInstanceOf(PostgresSyncStore);
  });

  it('KV bağlı değilse ilişkisel tarafa düşer (servis düşmez)', () => {
    expect(resolveStore(withoutKv, 'progress')).toBeInstanceOf(PostgresSyncStore);
  });

  it('yerleşim tablosu eksik yapılandırmayı bildirir', () => {
    expect(storagePlacement(withoutKv).progress).toContain('KV bağlı değil');
    expect(storagePlacement(withKv).progress).toBe('nosql');
  });
});
