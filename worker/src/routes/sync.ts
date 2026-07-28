import { HttpError } from '../errors';
import { requireSession } from '../auth';
import { Supabase } from '../supabase';
import { ok, type Ctx } from '../router';

/**
 * Senkronlanan koleksiyonlar — istemcideki liste ile birebir aynı olmalı.
 *
 * `saved` ("Sonra dinle") ayrı bir koleksiyon DEĞİLDİR: playlist sisteminin
 * sistem listesi olarak `playlists` içinde taşınır. Eski istemcilerin veri
 * kaybetmemesi için değer kabul edilmeye devam eder ama yeni istemci kullanmaz.
 */
export const SYNC_COLLECTIONS = ['progress', 'follows', 'saved', 'playlists'] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

/** Tek istekte kabul edilen en fazla kayıt — kötüye kullanımı sınırlar. */
const MAX_RECORDS = 500;

interface SyncRecord {
  readonly key: string;
  readonly value: string;
  readonly updatedAt: number;
  readonly deleted: boolean;
}

/** Veritabanı satırı (snake_case). */
interface SyncRow {
  readonly key: string;
  readonly value: string;
  readonly updated_at: number;
  readonly deleted: boolean;
}

/**
 * Senkron uçları — delta + son-yazan-kazanır.
 *
 * Kullanıcı verisine erişim DAİMA kullanıcının kendi jetonuyla yapılır; böylece
 * Postgres RLS devreye girer ve bir kullanıcı başkasının satırlarını hiçbir
 * koşulda göremez. Yetkilendirme uygulama kodunda değil, veritabanında zorunlu
 * kılınır.
 *
 * Çakışma çözümü veritabanındaki `merge_sync_records` fonksiyonunda yapılır:
 * gelen kayıt yalnızca `updated_at` sunucudakinden BÜYÜKSE yazılır. Bunu SQL
 * tarafında yapmak, oku-karşılaştır-yaz yarışını ortadan kaldırır.
 */
export const registerSyncRoutes = (router: {
  get: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  /** Belirtilen zamandan sonra değişmiş kayıtlar (delta çekme). */
  router.get('/v1/sync/:collection', async ctx => {
    const session = await requireSession(ctx);
    const collection = assertCollection(ctx.params.collection);
    const since = Number(ctx.query.get('since') ?? 0) || 0;

    const supabase = Supabase.from(ctx.env);
    const rows = await supabase
      .asUser(session.accessToken)
      .select<SyncRow>(
        'sync_records',
        `select=key,value,updated_at,deleted` +
          `&collection=eq.${encodeURIComponent(collection)}` +
          `&updated_at=gt.${since}` +
          `&order=updated_at.asc&limit=${MAX_RECORDS}`,
      );

    const records = rows.map(toRecord);
    return ok({
      records,
      // Bir sonraki çekmede kullanılacak imleç.
      cursor: records.reduce((max, r) => Math.max(max, r.updatedAt), since),
    });
  });

  /** Yerel değişiklikleri gönderir (birleştirme SQL tarafında). */
  router.post('/v1/sync/:collection', async ctx => {
    const session = await requireSession(ctx);
    const collection = assertCollection(ctx.params.collection);
    const records = assertRecords(ctx.body);

    const supabase = Supabase.from(ctx.env);
    const scope = supabase.asUser(session.accessToken);

    if (records.length > 0) {
      await scope.upsert(
        'sync_records',
        records.map(record => ({
          user_id: session.userId,
          collection,
          key: record.key,
          value: record.value,
          updated_at: record.updatedAt,
          deleted: record.deleted,
        })),
        'user_id,collection,key',
      );
    }

    return ok({
      accepted: records.length,
      cursor: records.reduce((max, r) => Math.max(max, r.updatedAt), 0),
    });
  });
};

const assertCollection = (value: string): SyncCollection => {
  if (!(SYNC_COLLECTIONS as readonly string[]).includes(value)) {
    throw HttpError.badRequest(
      `Bilinmeyen koleksiyon: ${value}. Geçerli: ${SYNC_COLLECTIONS.join(', ')}`,
    );
  }
  return value as SyncCollection;
};

/** Gövdeyi doğrular; bozuk kayıt tüm isteği reddeder (sessiz veri kaybı olmasın). */
const assertRecords = (body: unknown): SyncRecord[] => {
  const records = (body as { records?: unknown })?.records;
  if (!Array.isArray(records)) {
    throw HttpError.badRequest('records bir dizi olmalı');
  }
  if (records.length > MAX_RECORDS) {
    throw HttpError.badRequest(`En fazla ${MAX_RECORDS} kayıt gönderilebilir`);
  }
  return records.map((raw, index) => {
    const record = raw as Partial<SyncRecord>;
    if (typeof record.key !== 'string' || record.key.length === 0) {
      throw HttpError.badRequest(`records[${index}].key gerekli`);
    }
    if (typeof record.updatedAt !== 'number' || !Number.isFinite(record.updatedAt)) {
      throw HttpError.badRequest(`records[${index}].updatedAt sayı olmalı`);
    }
    return {
      key: record.key,
      value: typeof record.value === 'string' ? record.value : '',
      updatedAt: record.updatedAt,
      deleted: record.deleted === true,
    };
  });
};

const toRecord = (row: SyncRow): SyncRecord => ({
  key: row.key,
  value: row.value,
  updatedAt: Number(row.updated_at),
  deleted: row.deleted,
});
