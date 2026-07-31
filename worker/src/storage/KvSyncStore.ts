import type { SyncCollection } from '../routes/sync';
import type { SyncRecord, SyncScope, SyncStore } from './SyncStore';

/**
 * Cloudflare KV'nin kullandığımız yüzeyi.
 *
 * Tip `@cloudflare/workers-types` yerine burada tanımlanır: bağımlılık
 * eklemeden, yalnızca ihtiyacımız olan üç metot.
 */
export interface KvNamespace {
  get(key: string, type: 'text'): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
  list(options: { prefix: string; limit?: number; cursor?: string }): Promise<{
    keys: { name: string }[];
    list_complete: boolean;
    cursor?: string;
  }>;
}

/** Tek bir kaydın KV'de saklanan biçimi. */
interface KvEntry {
  readonly v: string;
  readonly u: number;
  readonly d: boolean;
}

/**
 * KvSyncStore — kayıtları Cloudflare KV'de (NoSQL) tutar.
 *
 * NEDEN NoSQL: bu koleksiyonlar (kaldığın yer, tercihler) YÜKSEK HACİMLİ,
 * ilişkisiz ve anahtarla erişilen verilerdir. Bir bölümü dinlerken konum
 * saniyeler içinde defalarca güncellenir; bu yazmaların ilişkisel bir tabloya
 * gitmesi hem gereksiz hem de ölçeklendiği yerde pahalıdır. Join, rapor ya da
 * bütünlük kısıtı gerektirmezler.
 *
 * Anahtar düzeni: `<collection>:<userId>:<key>`. Kullanıcı ayrımı anahtarın
 * içindedir; bir kullanıcının kayıtları başka bir kullanıcının önekiyle
 * listelenemez.
 *
 * TUTARLILIK: KV nihai tutarlıdır (yazma diğer bölgelere ~saniyeler içinde
 * yayılır). Kabul edilebilir — "kaldığın yer" bilgisinin bir cihazdan diğerine
 * birkaç saniyede geçmesi sorun değildir. Aynı sebeple para/abonelik verisi
 * BURADA TUTULMAZ.
 */
export class KvSyncStore implements SyncStore {
  constructor(private readonly kv: KvNamespace) {}

  async changesSince(
    scope: SyncScope,
    collection: SyncCollection,
    since: number,
    limit: number,
  ): Promise<readonly SyncRecord[]> {
    const prefix = `${collection}:${scope.userId}:`;
    const names = await this.listKeys(prefix, limit);

    const entries = await Promise.all(
      names.map(async name => {
        const raw = await this.kv.get(name, 'text');
        const entry = parse(raw);
        return entry ? { key: name.slice(prefix.length), entry } : null;
      }),
    );

    return entries
      .filter((item): item is { key: string; entry: KvEntry } => !!item)
      .filter(({ entry }) => entry.u > since)
      .map(({ key, entry }) => ({
        key,
        value: entry.v,
        updatedAt: entry.u,
        deleted: entry.d,
      }))
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .slice(0, limit);
  }

  async put(
    scope: SyncScope,
    collection: SyncCollection,
    records: readonly SyncRecord[],
  ): Promise<void> {
    await Promise.all(
      records.map(async record => {
        const name = `${collection}:${scope.userId}:${record.key}`;
        // Son-yazan-kazanır: ilişkisel taraftaki tetikleyicinin karşılığı.
        // KV atomik karşılaştırma sunmadığı için oku-karşılaştır-yaz yapılır;
        // aynı anahtara eşzamanlı yazma bir kullanıcının tek bölümü için
        // gerçekleşir ve kaybedilen yazma bir sonraki turda düzelir.
        const existing = parse(await this.kv.get(name, 'text'));
        if (existing && existing.u >= record.updatedAt) {
          return;
        }
        const entry: KvEntry = {
          v: record.value,
          u: record.updatedAt,
          d: record.deleted,
        };
        await this.kv.put(name, JSON.stringify(entry));
      }),
    );
  }

  /** Önekle eşleşen anahtarları toplar (KV sayfalı liste döner). */
  private async listKeys(prefix: string, limit: number): Promise<string[]> {
    const names: string[] = [];
    let cursor: string | undefined;

    do {
      const page = await this.kv.list({ prefix, limit: 1000, cursor });
      names.push(...page.keys.map(k => k.name));
      cursor = page.list_complete ? undefined : page.cursor;
      // Tek istekte sınırsız anahtar taramak cron/istek penceresini kilitler.
    } while (cursor && names.length < limit * 10);

    return names;
  }
}

/** Bozuk kayıt tüm senkronu düşürmemeli: çözülemeyen giriş atlanır. */
const parse = (raw: string | null): KvEntry | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<KvEntry>;
    return typeof parsed?.u === 'number' && typeof parsed.v === 'string'
      ? { v: parsed.v, u: parsed.u, d: !!parsed.d }
      : null;
  } catch {
    return null;
  }
};
