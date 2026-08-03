import type { Env } from '../env';
import type { SyncCollection } from '../routes/sync';
import { HttpRedisClient } from './HttpRedisClient';
import { KvSyncStore } from './KvSyncStore';
import { PostgresSyncStore } from './PostgresSyncStore';
import { RedisSyncStore } from './RedisSyncStore';
import type { SyncStore } from './SyncStore';

/**
 * Koleksiyon → depo yerleşimi. **Veri mimarisinin tek karar noktası budur.**
 *
 * | Koleksiyon    | Yer      | Neden                                            |
 * |---------------|----------|--------------------------------------------------|
 * | `progress`    | NoSQL    | En yüksek yazma hacmi; ilişkisiz, anahtarla erişilir |
 * | `preferences` | NoSQL    | Küçük, kullanıcıya özel bayraklar; sorgulanmaz    |
 * | `follows`     | Postgres | "Bu şovu kimler takip ediyor" sorgulanır (bildirim) |
 * | `playlists`   | Postgres | Kütüphane verisi; raporlanır, izdüşürülebilir      |
 * | `saved`       | Postgres | Playlist sisteminin parçası (eski istemciler için) |
 *
 * Bir koleksiyonu taşımak = bu tabloda tek satır değiştirmek. Rotalar
 * yerleşimi bilmez.
 */
const PLACEMENT: Record<SyncCollection, 'nosql' | 'postgres'> = {
  progress: 'nosql',
  preferences: 'nosql',
  follows: 'postgres',
  playlists: 'postgres',
  saved: 'postgres',
};

/**
 * NoSQL koleksiyonlarının deposu — sırayla denenir.
 *
 *  1. **Redis** (yapılandırılmışsa): delta okuma sıralı kümeyle yapılır ve
 *     maliyet DEĞİŞEN kayıt sayısıyla orantılıdır. Ölçekte doğru seçim budur.
 *  2. **Cloudflare KV**: delta okumayı desteklemez; tüm anahtarlar listelenip
 *     tek tek okunur. Küçük hacimde sorunsuz, kullanıcı başına kayıt
 *     biriktikçe pahalı.
 *  3. **Postgres**: hiçbiri bağlı değilse. Eksik yapılandırma servisi
 *     düşürmemeli, veri güvenli bir yerde durmalıdır.
 *
 * Protokol üçünde de aynı olduğu için istemci farkı görmez.
 */
const nosqlStore = (env: Env): SyncStore | null => {
  if (env.REDIS_URL && env.REDIS_TOKEN) {
    return new RedisSyncStore(new HttpRedisClient(env.REDIS_URL, env.REDIS_TOKEN));
  }
  if (env.USER_STATE) {
    return new KvSyncStore(env.USER_STATE);
  }
  return null;
};

/** Koleksiyonun deposunu çözer. */
export const resolveStore = (env: Env, collection: SyncCollection): SyncStore =>
  (PLACEMENT[collection] === 'nosql' ? nosqlStore(env) : null) ??
  new PostgresSyncStore(env);

/** Yerleşim tablosu — teşhis ucunda gösterilir. */
export const storagePlacement = (env: Env): Record<string, string> =>
  Object.fromEntries(
    (Object.keys(PLACEMENT) as SyncCollection[]).map(collection => [
      collection,
      PLACEMENT[collection] === 'postgres' ? 'postgres' : nosqlName(env),
    ]),
  );

/** Hangi NoSQL deposunun devrede olduğunu okunur biçimde bildirir. */
const nosqlName = (env: Env): string => {
  if (env.REDIS_URL && env.REDIS_TOKEN) {
    return 'redis';
  }
  return env.USER_STATE ? 'kv' : 'postgres (NoSQL bağlı değil)';
};
