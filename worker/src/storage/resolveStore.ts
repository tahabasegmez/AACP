import type { Env } from '../env';
import type { SyncCollection } from '../routes/sync';
import { KvSyncStore } from './KvSyncStore';
import { PostgresSyncStore } from './PostgresSyncStore';
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
 * Koleksiyonun deposunu çözer.
 *
 * KV bağlanmamışsa NoSQL koleksiyonları Postgres'e düşer: eksik yapılandırma
 * servisi düşürmemeli, veri yine güvenli bir yerde durmalıdır. Protokol her
 * iki tarafta aynı olduğu için istemci farkı görmez.
 */
export const resolveStore = (env: Env, collection: SyncCollection): SyncStore => {
  if (PLACEMENT[collection] === 'nosql' && env.USER_STATE) {
    return new KvSyncStore(env.USER_STATE);
  }
  return new PostgresSyncStore(env);
};

/** Yerleşim tablosu — teşhis ucunda gösterilir. */
export const storagePlacement = (env: Env): Record<string, string> =>
  Object.fromEntries(
    (Object.keys(PLACEMENT) as SyncCollection[]).map(collection => [
      collection,
      PLACEMENT[collection] === 'nosql' && !env.USER_STATE
        ? 'postgres (KV bağlı değil)'
        : PLACEMENT[collection],
    ]),
  );
