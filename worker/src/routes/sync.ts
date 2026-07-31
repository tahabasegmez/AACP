import { HttpError } from '../errors';
import { requireSession } from '../auth';
import { resolveStore } from '../storage/resolveStore';
import type { SyncRecord } from '../storage/SyncStore';
import { ok, type Ctx } from '../router';

/**
 * Senkronlanan koleksiyonlar — istemcideki liste ile birebir aynı olmalı.
 *
 * `saved` ("Sonra dinle") ayrı bir koleksiyon DEĞİLDİR: playlist sisteminin
 * sistem listesi olarak `playlists` içinde taşınır. Eski istemcilerin veri
 * kaybetmemesi için değer kabul edilmeye devam eder ama yeni istemci kullanmaz.
 */
export const SYNC_COLLECTIONS = [
  'progress',
  'follows',
  'saved',
  'playlists',
  // Kullanıcı tercihleri; her tercih ayrı kayıttır (anahtar = tercih adı).
  'preferences',
] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

/** Tek istekte kabul edilen en fazla kayıt — kötüye kullanımı sınırlar. */
const MAX_RECORDS = 500;

/**
 * Senkron uçları — delta + son-yazan-kazanır.
 *
 * Rotalar verinin NEREDE durduğunu bilmez: koleksiyon ilişkisel veritabanında
 * da olabilir, anahtar-değer deposunda da. Yerleşim kararı tek yerdedir
 * (`resolveStore`), protokol her ikisinde aynıdır.
 *
 * Kullanıcı verisine erişim DAİMA kullanıcının kendi kimliğiyle yapılır;
 * ilişkisel tarafta bunu Postgres RLS zorunlu kılar, anahtar-değer tarafında
 * kullanıcı kimliği anahtarın içindedir.
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

    const records = await resolveStore(ctx.env, collection).changesSince(
      session,
      collection,
      since,
      MAX_RECORDS,
    );

    return ok({
      records,
      // Bir sonraki çekmede kullanılacak imleç.
      cursor: records.reduce((max, r) => Math.max(max, r.updatedAt), since),
    });
  });

  /** Yerel değişiklikleri gönderir (birleştirme depo tarafında). */
  router.post('/v1/sync/:collection', async ctx => {
    const session = await requireSession(ctx);
    const collection = assertCollection(ctx.params.collection);
    const records = assertRecords(ctx.body);

    await resolveStore(ctx.env, collection).put(session, collection, records);

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
