import type { Env } from '../env';
import type { SyncCollection } from '../routes/sync';
import { Supabase } from '../supabase';
import type { SyncRecord, SyncScope, SyncStore } from './SyncStore';

/** Veritabanı satırı (snake_case). */
interface SyncRow {
  readonly key: string;
  readonly value: string;
  readonly updated_at: number;
  readonly deleted: boolean;
}

/**
 * PostgresSyncStore — kayıtları Supabase'deki `sync_records` tablosunda tutar.
 *
 * Erişim DAİMA kullanıcının kendi jetonuyla yapılır; böylece Row Level Security
 * devreye girer ve bir kullanıcı başkasının satırlarını hiçbir koşulda göremez.
 * Yetkilendirme uygulama kodunda değil, VERİTABANINDA zorunlu kılınır.
 *
 * Çakışma çözümü de veritabanındadır (`trg_sync_keep_newest`): gelen kayıt
 * yalnızca daha yeniyse yazılır. Bunu SQL tarafında yapmak, oku-karşılaştır-yaz
 * yarışını ortadan kaldırır.
 *
 * İlişkisel taraf, sorgulanması gereken veri içindir: listeler, takipler ve
 * "sonra dinle" sunucu tarafında raporlanabilir/izdüşürülebilir olmalıdır.
 */
export class PostgresSyncStore implements SyncStore {
  constructor(private readonly env: Env) {}

  async changesSince(
    scope: SyncScope,
    collection: SyncCollection,
    since: number,
    limit: number,
  ): Promise<readonly SyncRecord[]> {
    const rows = await Supabase.from(this.env)
      .asUser(scope.accessToken)
      .select<SyncRow>(
        'sync_records',
        'select=key,value,updated_at,deleted' +
          `&collection=eq.${encodeURIComponent(collection)}` +
          `&updated_at=gt.${since}` +
          `&order=updated_at.asc&limit=${limit}`,
      );

    return rows.map(row => ({
      key: row.key,
      value: row.value,
      updatedAt: row.updated_at,
      deleted: row.deleted,
    }));
  }

  async put(
    scope: SyncScope,
    collection: SyncCollection,
    records: readonly SyncRecord[],
  ): Promise<void> {
    if (records.length === 0) {
      return;
    }
    await Supabase.from(this.env)
      .asUser(scope.accessToken)
      .upsert(
        'sync_records',
        records.map(record => ({
          user_id: scope.userId,
          collection,
          key: record.key,
          value: record.value,
          updated_at: record.updatedAt,
          deleted: record.deleted,
        })),
        'user_id,collection,key',
      );
  }
}
