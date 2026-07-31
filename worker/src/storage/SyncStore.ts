import type { SyncCollection } from '../routes/sync';

export interface SyncRecord {
  readonly key: string;
  readonly value: string;
  /** İstemcideki değişiklik zamanı (epoch ms) — çakışma çözümü buna bakar. */
  readonly updatedAt: number;
  readonly deleted: boolean;
}

/** Depoya hangi kullanıcı adına erişildiği. */
export interface SyncScope {
  readonly userId: string;
  /** Kullanıcının erişim jetonu — Postgres'te RLS bunu kullanır. */
  readonly accessToken: string;
}

/**
 * SyncStore — bir senkron koleksiyonunun sunucu tarafındaki deposu.
 *
 * Rotalar verinin NEREDE durduğunu bilmez: koleksiyon → depo eşlemesi tek
 * yerdedir (`resolveStore`). Böylece bir koleksiyonu ilişkisel veritabanından
 * anahtar-değer deposuna (ya da tersine) taşımak, rota kodunu değiştirmeden
 * yapılabilir.
 *
 * Sözleşme her iki tarafta da AYNIDIR: delta okuma + son-yazan-kazanır yazma.
 */
export interface SyncStore {
  /** `since`'dan sonra değişmiş kayıtlar (artan `updatedAt` sırasıyla). */
  changesSince(
    scope: SyncScope,
    collection: SyncCollection,
    since: number,
    limit: number,
  ): Promise<readonly SyncRecord[]>;

  /**
   * Kayıtları yazar. Gelen kayıt yalnızca mevcuttan YENİYSE üzerine yazar;
   * bu kural her iki implementasyonda da korunmak zorundadır.
   */
  put(
    scope: SyncScope,
    collection: SyncCollection,
    records: readonly SyncRecord[],
  ): Promise<void>;
}
