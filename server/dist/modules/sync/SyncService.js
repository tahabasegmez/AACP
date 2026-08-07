"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SyncService = exports.SYNC_COLLECTIONS = void 0;
const errors_1 = require("../../core/errors");
/**
 * Senkronlanabilir koleksiyonlar — istemcinin gönderebileceği alanlar sabittir
 * (açık liste), böylece rastgele koleksiyon adlarıyla depo şişirilemez.
 */
exports.SYNC_COLLECTIONS = ['progress', 'follows', 'saved', 'playlists'];
/** Tek istekte kabul edilen en fazla kayıt — kötüye kullanımı sınırlar. */
const MAX_RECORDS_PER_PUSH = 500;
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
class SyncService {
    store;
    constructor(store) {
        this.store = store;
    }
    /** Verilen zamandan sonra değişen kayıtları döner. */
    async pull(userId, collection, since) {
        const safeCollection = assertCollection(collection);
        const safeSince = Number.isFinite(since) && since > 0 ? Math.floor(since) : 0;
        const records = await this.store.listSyncRecords(userId, safeCollection, safeSince);
        // İmleç: en yeni kaydın damgası (yoksa istemcinin gönderdiği değer korunur).
        const cursor = records.reduce((max, r) => Math.max(max, r.updatedAt), safeSince);
        return { records, cursor };
    }
    /** İstemci değişikliklerini birleştirir ve yeni imleci döner. */
    async push(userId, collection, records) {
        const safeCollection = assertCollection(collection);
        const parsed = parseRecords(records);
        await this.store.upsertSyncRecords(userId, safeCollection, parsed);
        const cursor = parsed.reduce((max, r) => Math.max(max, r.updatedAt), 0);
        return { accepted: parsed.length, cursor };
    }
}
exports.SyncService = SyncService;
const assertCollection = (value) => {
    if (!exports.SYNC_COLLECTIONS.includes(value)) {
        throw errors_1.HttpError.badRequest(`Bilinmeyen koleksiyon: ${value}. Geçerli: ${exports.SYNC_COLLECTIONS.join(', ')}`);
    }
    return value;
};
/** Gelen ham veriyi doğrular — uzak/istemci verisi asla doğrudan güvenilmez. */
const parseRecords = (raw) => {
    if (!Array.isArray(raw)) {
        throw errors_1.HttpError.badRequest('records bir dizi olmalı');
    }
    if (raw.length > MAX_RECORDS_PER_PUSH) {
        throw errors_1.HttpError.badRequest(`Tek istekte en fazla ${MAX_RECORDS_PER_PUSH} kayıt gönderilebilir`);
    }
    return raw.map((item, index) => {
        if (typeof item !== 'object' || item === null) {
            throw errors_1.HttpError.badRequest(`records[${index}] nesne olmalı`);
        }
        const o = item;
        const key = typeof o.key === 'string' ? o.key.trim() : '';
        if (!key) {
            throw errors_1.HttpError.badRequest(`records[${index}].key zorunlu`);
        }
        const updatedAt = Number(o.updatedAt);
        if (!Number.isFinite(updatedAt) || updatedAt <= 0) {
            throw errors_1.HttpError.badRequest(`records[${index}].updatedAt geçerli bir zaman damgası olmalı`);
        }
        // Değer JSON string olarak saklanır; sunucu içeriğini yorumlamaz (şemadan bağımsız).
        const value = typeof o.value === 'string' ? o.value : JSON.stringify(o.value ?? null);
        return { key, value, updatedAt: Math.floor(updatedAt), deleted: o.deleted === true };
    });
};
//# sourceMappingURL=SyncService.js.map