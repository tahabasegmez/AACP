import { HttpError } from '../../core/errors';
import type { Store, SyncRecord } from '../../storage/Store';

/**
 * Senkronlanabilir koleksiyonlar — istemcinin gönderebileceği alanlar sabittir
 * (açık liste), böylece rastgele koleksiyon adlarıyla depo şişirilemez.
 */
export const SYNC_COLLECTIONS = ['progress', 'follows', 'saved', 'playlists'] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

/** Tek istekte kabul edilen en fazla kayıt — kötüye kullanımı sınırlar. */
const MAX_RECORDS_PER_PUSH = 500;

export interface SyncPullResult {
  readonly records: readonly SyncRecord[];
  /** İstemcinin bir sonraki `since` değeri olarak saklayacağı damga. */
  readonly cursor: number;
}

/**
 * SyncService — cihazlar arası durum senkronu (kaldığın yer, takipler, sonra dinle).
 *
 * Model: **delta + son-yazan-kazanır**. Her kayıt istemcideki değişiklik zamanını
 * (`updatedAt`) taşır; sunucu daha yeni olanı saklar. Silmeler `deleted` bayrağıyla
 * (tombstone) taşınır ki bir cihazdaki silme diğerine ulaşsın.
 *
 * Bu model çakışmaları sessizce ve öngörülebilir biçimde çözer; podcast
 * kullanımında (aynı anda iki cihazdan aynı bölüme müdahale) pratikte yeterlidir.
 */
export class SyncService {
  constructor(private readonly store: Store) {}

  /** Verilen zamandan sonra değişen kayıtları döner. */
  async pull(
    userId: string,
    collection: string,
    since: number,
  ): Promise<SyncPullResult> {
    const safeCollection = assertCollection(collection);
    const safeSince = Number.isFinite(since) && since > 0 ? Math.floor(since) : 0;
    const records = await this.store.listSyncRecords(userId, safeCollection, safeSince);
    // İmleç: en yeni kaydın damgası (yoksa istemcinin gönderdiği değer korunur).
    const cursor = records.reduce((max, r) => Math.max(max, r.updatedAt), safeSince);
    return { records, cursor };
  }

  /** İstemci değişikliklerini birleştirir ve yeni imleci döner. */
  async push(
    userId: string,
    collection: string,
    records: unknown,
  ): Promise<{ accepted: number; cursor: number }> {
    const safeCollection = assertCollection(collection);
    const parsed = parseRecords(records);
    await this.store.upsertSyncRecords(userId, safeCollection, parsed);
    const cursor = parsed.reduce((max, r) => Math.max(max, r.updatedAt), 0);
    return { accepted: parsed.length, cursor };
  }
}

const assertCollection = (value: string): SyncCollection => {
  if (!(SYNC_COLLECTIONS as readonly string[]).includes(value)) {
    throw HttpError.badRequest(
      `Bilinmeyen koleksiyon: ${value}. Geçerli: ${SYNC_COLLECTIONS.join(', ')}`,
    );
  }
  return value as SyncCollection;
};

/** Gelen ham veriyi doğrular — uzak/istemci verisi asla doğrudan güvenilmez. */
const parseRecords = (raw: unknown): SyncRecord[] => {
  if (!Array.isArray(raw)) {
    throw HttpError.badRequest('records bir dizi olmalı');
  }
  if (raw.length > MAX_RECORDS_PER_PUSH) {
    throw HttpError.badRequest(`Tek istekte en fazla ${MAX_RECORDS_PER_PUSH} kayıt gönderilebilir`);
  }

  return raw.map((item, index) => {
    if (typeof item !== 'object' || item === null) {
      throw HttpError.badRequest(`records[${index}] nesne olmalı`);
    }
    const o = item as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim() : '';
    if (!key) {
      throw HttpError.badRequest(`records[${index}].key zorunlu`);
    }
    const updatedAt = Number(o.updatedAt);
    if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
      throw HttpError.badRequest(`records[${index}].updatedAt geçerli bir zaman damgası olmalı`);
    }
    // Değer JSON string olarak saklanır; sunucu içeriğini yorumlamaz (şemadan bağımsız).
    const value =
      typeof o.value === 'string' ? o.value : JSON.stringify(o.value ?? null);

    return { key, value, updatedAt: Math.floor(updatedAt), deleted: o.deleted === true };
  });
};
