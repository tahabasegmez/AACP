/**
 * Senkron sözleşmeleri — istemci tarafı.
 *
 * Model sunucudakiyle aynıdır: **delta + son-yazan-kazanır**. Her kayıt bir
 * anahtar, JSON değer ve değişiklik zamanı taşır; silmeler `deleted` bayrağıyla
 * (tombstone) yolculuk eder ki bir cihazdaki silme diğerine ulaşsın.
 */

/** Senkronlanan koleksiyonlar — sunucudaki liste ile birebir aynı olmalı. */
export const SYNC_COLLECTIONS = ['progress', 'follows', 'saved', 'playlists'] as const;
export type SyncCollection = (typeof SYNC_COLLECTIONS)[number];

export interface SyncRecord {
  readonly key: string;
  /** Serileştirilmiş yük (JSON). */
  readonly value: string;
  /** Değişiklik zamanı (epoch ms). */
  readonly updatedAt: number;
  readonly deleted: boolean;
}

/**
 * SyncCollectionAdapter — bir koleksiyonun yerel tarafını temsil eder.
 *
 * Motor, verinin nerede/nasıl saklandığını bilmez; yalnızca "yerel değişiklikleri
 * ver" ve "uzak değişiklikleri uygula" der. Yeni bir senkronlanabilir veri türü
 * eklemek = yeni bir adaptör yazmak.
 */
export interface SyncCollectionAdapter {
  readonly collection: SyncCollection;
  /** Verilen zamandan sonra yerelde değişmiş kayıtlar. */
  localChanges(since: number): Promise<readonly SyncRecord[]>;
  /** Sunucudan gelen kayıtları yerele işler (daha yeni olan kazanır). */
  applyRemote(records: readonly SyncRecord[]): Promise<void>;
}
