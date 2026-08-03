import type { SyncCollection } from '../routes/sync';
import type { SyncRecord, SyncScope, SyncStore } from './SyncStore';

/**
 * Redis'in kullandığımız yüzeyi — HTTP üzerinden komut çalıştırır.
 *
 * Arayüz burada tanımlanır ki sağlayıcı (Upstash vb.) değişse bile depo kodu
 * etkilenmesin ve test için sahte bir istemci verilebilsin.
 */
export interface RedisClient {
  /** Komutları TEK istekte çalıştırır; sırayla sonuçlarını döner. */
  pipeline(commands: readonly (readonly string[])[]): Promise<unknown[]>;
}

/** Kayıtların JSON gövdesi (KV ile aynı kısa alan adları). */
interface StoredEntry {
  readonly v: string;
  readonly u: number;
  readonly d: boolean;
}

/**
 * Son-yazan-kazanır yazmanın ATOMİK hâli.
 *
 * Oku-karşılaştır-yaz iki tur gerektirir ve aradaki pencerede eşzamanlı bir
 * yazma kaybolabilir. Script sunucuda tek parça çalışır: karşılaştırma ve
 * yazma bölünemez, dolayısıyla Postgres tarafındaki tetikleyiciyle aynı
 * garantiyi verir.
 *
 * Dizin (sorted set) ve gövde (hash) aynı script içinde güncellenir; okuyan
 * taraf asla dizinde olup gövdesi eski olan bir kayıt göremez.
 */
const PUT_SCRIPT = `
local written = 0
for i = 1, #ARGV, 3 do
  local member = ARGV[i]
  local score = tonumber(ARGV[i + 1])
  local current = redis.call('ZSCORE', KEYS[1], member)
  if current == false or tonumber(current) < score then
    redis.call('ZADD', KEYS[1], score, member)
    redis.call('HSET', KEYS[2], member, ARGV[i + 2])
    written = written + 1
  end
end
return written
`;

/**
 * RedisSyncStore — kayıtları Redis'te SIRALI KÜME + hash olarak tutar.
 *
 * NEDEN: delta senkron "şu andan sonra değişenleri ver" sorusudur. Anahtar-değer
 * deposunda bu soru cevaplanamaz; tüm anahtarlar listelenip her biri okunur ve
 * filtre bellekte uygulanır — 2.000 bölüm dinlemiş bir kullanıcı için 3 kayıt
 * değişmiş olsa bile 2.000 okuma demektir. Bu maliyet kullanıcı başına
 * biriktikçe senkronu ölçeklenemez hâle getirir.
 *
 * Sıralı küme bu soruyu doğrudan yanıtlar: skor `updatedAt`, üye kayıt
 * anahtarıdır; `ZRANGEBYSCORE` yalnızca değişenleri, sıralı biçimde döner.
 * Maliyet değişen kayıt sayısıyla orantılıdır, toplam kayıt sayısıyla değil.
 *
 * Anahtar düzeni:
 *   `<koleksiyon>:<kullanıcıId>:z` → sıralı dizin (skor = updatedAt)
 *   `<koleksiyon>:<kullanıcıId>:h` → gövdeler (alan = kayıt anahtarı)
 *
 * Kullanıcı ayrımı anahtarın içindedir; bir kullanıcının kayıtları başka bir
 * kullanıcının önekiyle okunamaz.
 */
export class RedisSyncStore implements SyncStore {
  constructor(private readonly redis: RedisClient) {}

  async changesSince(
    scope: SyncScope,
    collection: SyncCollection,
    since: number,
    limit: number,
  ): Promise<readonly SyncRecord[]> {
    const { index, data } = keys(collection, scope.userId);

    // `(` öneki DIŞLAYICI sınır demektir: `since` anındaki kayıt zaten
    // istemcide vardır, tekrar göndermek her senkronda aynı kaydı taşımaktı.
    const [members] = await this.redis.pipeline([
      ['ZRANGEBYSCORE', index, `(${since}`, '+inf', 'LIMIT', '0', String(limit)],
    ]);

    const names = asStrings(members);
    if (names.length === 0) {
      return [];
    }

    const [values] = await this.redis.pipeline([['HMGET', data, ...names]]);
    const bodies = asStrings(values);

    return names
      .map((key, position) => toRecord(key, bodies[position]))
      .filter((record): record is SyncRecord => record !== null);
  }

  async put(
    scope: SyncScope,
    collection: SyncCollection,
    records: readonly SyncRecord[],
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }
    const { index, data } = keys(collection, scope.userId);

    const args = records.flatMap(record => [
      record.key,
      String(record.updatedAt),
      JSON.stringify({ v: record.value, u: record.updatedAt, d: record.deleted }),
    ]);

    await this.redis.pipeline([['EVAL', PUT_SCRIPT, '2', index, data, ...args]]);
  }
}

/** Bir kullanıcı+koleksiyon çiftinin anahtarları. */
const keys = (collection: SyncCollection, userId: string) => ({
  index: `${collection}:${userId}:z`,
  data: `${collection}:${userId}:h`,
});

/** Redis yanıtını metin dizisine indirger; beklenmeyen biçim boş sayılır. */
const asStrings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(item => (typeof item === 'string' ? item : '')) : [];

/** Bozuk kayıt tüm senkronu düşürmemeli: çözülemeyen giriş atlanır. */
const toRecord = (key: string, raw: string | undefined): SyncRecord | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<StoredEntry>;
    if (typeof parsed?.u !== 'number' || typeof parsed.v !== 'string') {
      return null;
    }
    return { key, value: parsed.v, updatedAt: parsed.u, deleted: !!parsed.d };
  } catch {
    return null;
  }
};
