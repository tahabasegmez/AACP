import { describe, expect, it } from 'vitest';
import { KvSyncStore, type KvNamespace } from '../storage/KvSyncStore';
import { resolveStore, storagePlacement } from '../storage/resolveStore';
import { PostgresSyncStore } from '../storage/PostgresSyncStore';
import { RedisSyncStore, type RedisClient } from '../storage/RedisSyncStore';
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
  const withRedis = {
    USER_STATE: new FakeKv(),
    REDIS_URL: 'https://redis',
    REDIS_TOKEN: 'jeton',
  } as unknown as Env;

  it('yüksek hacimli koleksiyonlar NoSQL tarafına gider', () => {
    expect(resolveStore(withKv, 'progress')).toBeInstanceOf(KvSyncStore);
    expect(resolveStore(withKv, 'preferences')).toBeInstanceOf(KvSyncStore);
  });

  it('Redis yapılandırılmışsa KV yerine ONU seçer', () => {
    // Delta okuma KV'de tüm anahtarları taramak demek; Redis sıralı kümeyle
    // yalnızca değişenleri döner.
    expect(resolveStore(withRedis, 'progress')).toBeInstanceOf(RedisSyncStore);
    expect(resolveStore(withRedis, 'preferences')).toBeInstanceOf(RedisSyncStore);
  });

  it('Redis varken bile ilişkisel koleksiyonlar Postgres kalır', () => {
    expect(resolveStore(withRedis, 'follows')).toBeInstanceOf(PostgresSyncStore);
  });

  it('sorgulanan kütüphane verisi ilişkisel tarafta kalır', () => {
    expect(resolveStore(withKv, 'follows')).toBeInstanceOf(PostgresSyncStore);
    expect(resolveStore(withKv, 'playlists')).toBeInstanceOf(PostgresSyncStore);
    expect(resolveStore(withKv, 'saved')).toBeInstanceOf(PostgresSyncStore);
  });

  it('hiçbir NoSQL bağlı değilse ilişkisel tarafa düşer (servis düşmez)', () => {
    expect(resolveStore(withoutKv, 'progress')).toBeInstanceOf(PostgresSyncStore);
  });

  it('yarım Redis yapılandırması yok sayılır', () => {
    // Yalnızca adres verilip jeton unutulduğunda sessizce hataya düşmek yerine
    // bir alt kademeye inilir.
    const half = { USER_STATE: new FakeKv(), REDIS_URL: 'https://redis' } as unknown as Env;
    expect(resolveStore(half, 'progress')).toBeInstanceOf(KvSyncStore);
  });

  it('yerleşim tablosu hangi deponun devrede olduğunu bildirir', () => {
    expect(storagePlacement(withoutKv).progress).toContain('NoSQL bağlı değil');
    expect(storagePlacement(withKv).progress).toBe('kv');
    expect(storagePlacement(withRedis).progress).toBe('redis');
    expect(storagePlacement(withRedis).follows).toBe('postgres');
  });
});

describe('RedisSyncStore', () => {
  /** Bellek içi Redis — yalnızca kullandığımız komutları anlar. */
  class FakeRedis implements RedisClient {
    readonly zsets = new Map<string, Map<string, number>>();
    readonly hashes = new Map<string, Map<string, string>>();
    readonly seen: string[][] = [];

    async pipeline(commands: readonly (readonly string[])[]): Promise<unknown[]> {
      return commands.map(command => {
        this.seen.push([...command]);
        const [name, ...args] = command;

        if (name === 'ZRANGEBYSCORE') {
          const [key, min] = args;
          const limit = Number(args[args.indexOf('LIMIT') + 2] ?? Infinity);
          const exclusive = Number(min.replace('(', ''));
          return [...(this.zsets.get(key) ?? new Map())]
            .filter(([, score]) => score > exclusive)
            .sort((a, b) => a[1] - b[1])
            .slice(0, limit)
            .map(([member]) => member);
        }

        if (name === 'HMGET') {
          const [key, ...fields] = args;
          const hash = this.hashes.get(key) ?? new Map();
          return fields.map(field => hash.get(field) ?? null);
        }

        if (name === 'EVAL') {
          // Script'in davranışını taklit eder: yalnızca DAHA YENİ kayıt yazılır.
          const [, , index, data, ...values] = args;
          const zset = this.zsets.get(index) ?? new Map<string, number>();
          const hash = this.hashes.get(data) ?? new Map<string, string>();
          let written = 0;

          for (let i = 0; i < values.length; i += 3) {
            const member = values[i];
            const score = Number(values[i + 1]);
            if (!zset.has(member) || (zset.get(member) ?? 0) < score) {
              zset.set(member, score);
              hash.set(member, values[i + 2]);
              written += 1;
            }
          }
          this.zsets.set(index, zset);
          this.hashes.set(data, hash);
          return written;
        }

        throw new Error(`bilinmeyen komut: ${name}`);
      });
    }
  }

  it('yazılan kaydı delta olarak geri verir', async () => {
    const store = new RedisSyncStore(new FakeRedis());
    await store.put(scope, 'progress', [
      { key: 'ep1', value: '{"p":10}', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records).toEqual([
      { key: 'ep1', value: '{"p":10}', updatedAt: 100, deleted: false },
    ]);
  });

  it('yalnızca DEĞİŞENLERİ okur — asıl kazanç budur', async () => {
    const redis = new FakeRedis();
    const store = new RedisSyncStore(redis);

    await store.put(scope, 'progress', [
      { key: 'eski', value: 'v', updatedAt: 100, deleted: false },
      { key: 'yeni', value: 'v', updatedAt: 300, deleted: false },
    ]);
    redis.seen.length = 0;

    const records = await store.changesSince(scope, 'progress', 200, 50);

    expect(records.map(r => r.key)).toEqual(['yeni']);
    // Gövde yalnızca değişen kayıt için istenmeli; tüm anahtarları okumak
    // KV'deki sorunun ta kendisiydi.
    const hmget = redis.seen.find(command => command[0] === 'HMGET');
    expect(hmget?.slice(2)).toEqual(['yeni']);
  });

  it('sınır DIŞLAYICIDIR — aynı kayıt her senkronda tekrar gelmez', async () => {
    const store = new RedisSyncStore(new FakeRedis());
    await store.put(scope, 'progress', [
      { key: 'a', value: 'v', updatedAt: 100, deleted: false },
    ]);

    expect(await store.changesSince(scope, 'progress', 100, 50)).toEqual([]);
  });

  it('eski kayıt yeniyi EZMEZ (son yazan kazanır)', async () => {
    const store = new RedisSyncStore(new FakeRedis());
    await store.put(scope, 'progress', [
      { key: 'a', value: 'yeni', updatedAt: 200, deleted: false },
    ]);
    await store.put(scope, 'progress', [
      { key: 'a', value: 'eski', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records[0].value).toBe('yeni');
  });

  it('kullanıcılar birbirinin kaydını göremez', async () => {
    const redis = new FakeRedis();
    const store = new RedisSyncStore(redis);
    await store.put(scope, 'progress', [
      { key: 'a', value: 'benim', updatedAt: 100, deleted: false },
    ]);

    expect(await store.changesSince(other, 'progress', 0, 50)).toEqual([]);
  });

  it('koleksiyonlar birbirine karışmaz', async () => {
    const store = new RedisSyncStore(new FakeRedis());
    await store.put(scope, 'progress', [
      { key: 'a', value: 'v', updatedAt: 100, deleted: false },
    ]);

    expect(await store.changesSince(scope, 'preferences', 0, 50)).toEqual([]);
  });

  it('silme (tombstone) taşınır', async () => {
    const store = new RedisSyncStore(new FakeRedis());
    await store.put(scope, 'preferences', [
      { key: 'x', value: '', updatedAt: 100, deleted: true },
    ]);

    const records = await store.changesSince(scope, 'preferences', 0, 50);
    expect(records[0].deleted).toBe(true);
  });

  it('sonuçlar zamana göre artan sırada gelir', async () => {
    const store = new RedisSyncStore(new FakeRedis());
    await store.put(scope, 'progress', [
      { key: 'b', value: 'v', updatedAt: 200, deleted: false },
      { key: 'a', value: 'v', updatedAt: 100, deleted: false },
    ]);

    const records = await store.changesSince(scope, 'progress', 0, 50);
    expect(records.map(r => r.key)).toEqual(['a', 'b']);
  });

  it('bozuk gövde tüm senkronu düşürmez', async () => {
    const redis = new FakeRedis();
    redis.zsets.set('progress:u1:z', new Map([['bozuk', 100], ['saglam', 100]]));
    redis.hashes.set('progress:u1:h', new Map([['bozuk', '{yok'], ['saglam', '{"v":"x","u":100,"d":false}']]));

    const records = await new RedisSyncStore(redis).changesSince(scope, 'progress', 0, 50);
    expect(records.map(r => r.key)).toEqual(['saglam']);
  });

  it('boş yazma isteği hiç gönderilmez', async () => {
    const redis = new FakeRedis();
    await new RedisSyncStore(redis).put(scope, 'progress', []);
    expect(redis.seen).toEqual([]);
  });
});
