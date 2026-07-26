import { Logger } from '@core/logger';
import { KeyValueStorage } from '@core/ports';
import { SyncCollectionAdapter, SyncRecord } from './SyncTypes';

/** İmleçlerin (son senkron damgası) saklandığı anahtar öneki. */
const CURSOR_PREFIX = 'aacp.sync.cursor.';

/** Sunucudan çekme/gönderme işlemlerini yapan taşıma katmanı. */
export interface SyncTransport {
  /** Backend erişilebilir mi (yapılandırılmış ve oturum açılabiliyor mu). */
  readonly enabled: boolean;
  pull(collection: string, since: number): Promise<{ records: SyncRecord[]; cursor: number }>;
  push(collection: string, records: readonly SyncRecord[]): Promise<{ cursor: number }>;
}

/**
 * SyncEngine — cihazlar arası senkronu yürüten motor.
 *
 * Akış (koleksiyon başına):
 *   1. Yerelde `cursor`'dan sonra değişenleri sunucuya gönder,
 *   2. Sunucudan `cursor`'dan sonra değişenleri çek ve yerele uygula,
 *   3. Yeni imleci sakla.
 *
 * Tasarım ilkesi: senkron **en iyi çaba**dır. Ağ yoksa veya sunucu
 * yapılandırılmamışsa sessizce atlanır; uygulama tamamen yerel çalışmaya devam
 * eder ve hiçbir kullanıcı akışı bloke olmaz.
 */
export class SyncEngine {
  private running = false;

  constructor(
    private readonly transport: SyncTransport,
    private readonly adapters: readonly SyncCollectionAdapter[],
    private readonly storage: KeyValueStorage,
    private readonly logger: Logger,
  ) {}

  get enabled(): boolean {
    return this.transport.enabled;
  }

  /**
   * Tüm koleksiyonları senkronlar. Eşzamanlı çağrılar tek turda birleşir
   * (aynı anda iki senkron çalışmaz).
   */
  async syncAll(): Promise<void> {
    if (!this.transport.enabled || this.running) {
      return;
    }
    this.running = true;
    try {
      for (const adapter of this.adapters) {
        await this.syncOne(adapter);
      }
    } finally {
      this.running = false;
    }
  }

  /** Tek bir koleksiyonu senkronlar; hata olursa diğerleri etkilenmez. */
  private async syncOne(adapter: SyncCollectionAdapter): Promise<void> {
    const { collection } = adapter;
    try {
      const cursor = this.readCursor(collection);

      // 1) Yerel → sunucu
      const local = await adapter.localChanges(cursor);
      if (local.length > 0) {
        await this.transport.push(collection, local);
      }

      // 2) Sunucu → yerel
      const remote = await this.transport.pull(collection, cursor);
      if (remote.records.length > 0) {
        await adapter.applyRemote(remote.records);
      }

      // 3) İmleci ilerlet — yerel ve uzak damgaların en büyüğü.
      const localMax = local.reduce((max, r) => Math.max(max, r.updatedAt), 0);
      this.writeCursor(collection, Math.max(cursor, remote.cursor, localMax));
    } catch (error) {
      // Senkron başarısız olabilir (çevrimdışı, sunucu kapalı): bu normaldir.
      this.logger.warn(`Senkron başarısız: ${collection}`, error);
    }
  }

  private readCursor(collection: string): number {
    const raw = this.storage.getString(`${CURSOR_PREFIX}${collection}`);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private writeCursor(collection: string, cursor: number): void {
    this.storage.set(`${CURSOR_PREFIX}${collection}`, String(cursor));
  }
}
