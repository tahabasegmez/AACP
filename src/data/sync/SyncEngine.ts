import { Logger } from '@core/logger';
import { KeyValueStorage } from '@core/ports';
import {
  INITIAL_SYNC_STATUS,
  SyncStatus,
  SyncStatusListener,
} from '@domain/entities';
import { SyncCollectionAdapter, SyncRecord } from './SyncTypes';

/** İmleçlerin (son senkron damgası) saklandığı anahtar öneki. */
const CURSOR_PREFIX = 'aacp.sync.cursor.';
/** Son başarılı senkron zamanının anahtarı — uygulama yeniden açılınca korunur. */
const LAST_SYNC_KEY = 'aacp.sync.lastAt';

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
 *
 * Motor ayrıca DURUM yayınlar (`subscribe`): kullanıcı ne zaman senkronlandığını,
 * bekleyen değişiklik olup olmadığını ve çakışmaları görebilir.
 */
export class SyncEngine {
  private running = false;
  private status: SyncStatus = INITIAL_SYNC_STATUS;
  private readonly listeners = new Set<SyncStatusListener>();

  constructor(
    private readonly transport: SyncTransport,
    private readonly adapters: readonly SyncCollectionAdapter[],
    private readonly storage: KeyValueStorage,
    private readonly logger: Logger,
  ) {
    this.status = { ...INITIAL_SYNC_STATUS, lastSyncAt: this.readLastSync() };
  }

  get enabled(): boolean {
    return this.transport.enabled;
  }

  /** Anlık durum (senkron zamanı, bekleyenler, hata). */
  getStatus(): SyncStatus {
    return this.status;
  }

  /** Durum değişikliklerine abone olur; aboneliği iptal eden fonksiyon döner. */
  subscribe(listener: SyncStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Gönderilmeyi bekleyen yerel değişiklik sayısını hesaplar.
   *
   * Ağa çıkmaz — yalnızca yerel adaptörlere sorar. Bu sayede UI, senkron
   * çalıştırmadan "kaç değişiklik bekliyor" gösterebilir.
   */
  async countPending(): Promise<number> {
    let total = 0;
    for (const adapter of this.adapters) {
      try {
        const changes = await adapter.localChanges(this.readCursor(adapter.collection));
        total += changes.length;
      } catch {
        // Bir koleksiyon okunamazsa sayım eksik kalır; bu bilgi amaçlıdır.
      }
    }
    this.emit({ pendingCount: total });
    return total;
  }

  /**
   * Tüm koleksiyonları senkronlar. Eşzamanlı çağrılar tek turda birleşir
   * (aynı anda iki senkron çalışmaz).
   *
   * Hata durumunda `throwOnError` ile çağıran bilgilendirilebilir; varsayılan
   * davranış sessiz kalmaktır (arka plan senkronu kullanıcıyı rahatsız etmez).
   */
  async syncAll(options?: { throwOnError?: boolean }): Promise<SyncStatus> {
    if (!this.transport.enabled) {
      return this.status;
    }
    if (this.running) {
      return this.status;
    }

    this.running = true;
    this.emit({ phase: 'syncing', error: undefined });

    let failed: unknown;
    let conflicts = 0;

    try {
      for (const adapter of this.adapters) {
        try {
          conflicts += await this.syncOne(adapter);
        } catch (error) {
          // Bir koleksiyonun hatası diğerlerini durdurmaz; ilk hata saklanır.
          failed ??= error;
          this.logger.warn(`Senkron başarısız: ${adapter.collection}`, error);
        }
      }

      if (failed) {
        this.emit({ phase: 'error', error: describe(failed), conflictCount: conflicts });
        if (options?.throwOnError) {
          throw failed;
        }
      } else {
        const now = Date.now();
        this.writeLastSync(now);
        this.emit({
          phase: 'success',
          lastSyncAt: now,
          error: undefined,
          conflictCount: conflicts,
          pendingCount: 0,
        });
      }
    } finally {
      this.running = false;
    }

    return this.status;
  }

  /**
   * Tek bir koleksiyonu senkronlar; çakışan (uzak veri tarafından geçersiz
   * kılınan) yerel kayıt sayısını döner.
   */
  private async syncOne(adapter: SyncCollectionAdapter): Promise<number> {
    const { collection } = adapter;
    const cursor = this.readCursor(collection);

    // 1) Yerel → sunucu
    const local = await adapter.localChanges(cursor);
    if (local.length > 0) {
      await this.transport.push(collection, local);
    }

    // 2) Sunucu → yerel
    const remote = await this.transport.pull(collection, cursor);

    // Çakışma: aynı anahtar hem yerelde değişmiş hem uzaktan DAHA YENİ gelmiş.
    // Uzak kayıt kazanır (son yazan kazanır); sayıyı kullanıcıya bildiririz.
    const localByKey = new Map(local.map(record => [record.key, record]));
    const conflicts = remote.records.filter(record => {
      const mine = localByKey.get(record.key);
      return mine !== undefined && record.updatedAt > mine.updatedAt;
    }).length;

    if (remote.records.length > 0) {
      await adapter.applyRemote(remote.records);
    }

    // 3) İmleci ilerlet — yerel ve uzak damgaların en büyüğü.
    const localMax = local.reduce((max, r) => Math.max(max, r.updatedAt), 0);
    this.writeCursor(collection, Math.max(cursor, remote.cursor, localMax));

    return conflicts;
  }

  /**
   * KİMLİK DEĞİŞİMİ — yerel veriyi hesaba TAŞIYARAK devam eder.
   *
   * Cihazdaki değişiklikler yeni hesaba ait sayılır ve sunucuya gönderilir;
   * ardından hesabın verisi indirilir. İki taraf da korunur (çakışanlarda son
   * yazan kazanır).
   *
   * Kullanıcı "bu cihazdaki verilerimi hesabıma aktar" dediğinde çağrılır.
   */
  async adoptLocalInto(): Promise<SyncStatus> {
    // İmleçler önceki kimliğe aitti: sıfırlanır ki TÜM yerel veri "değişmiş"
    // sayılıp gönderilsin ve hesabın tamamı indirilsin.
    this.clearCursors();
    return this.syncAll();
  }

  /**
   * KİMLİK DEĞİŞİMİ — cihazdaki veriyi ATARAK hesabınkiyle devam eder.
   *
   * Kullanıcı "hesabımdaki verilerle devam et" dediğinde ya da çıkış
   * yaptığında çağrılır. Yerel veri silinir, imleçler sıfırlanır ve sunucudan
   * temiz bir kopya indirilir.
   *
   * İndirmelere DOKUNULMAZ: onlar cihaza özgüdür ve hiçbir hesaba ait değildir.
   */
  async replaceWithRemote(): Promise<SyncStatus> {
    for (const adapter of this.adapters) {
      try {
        await adapter.clearLocal();
      } catch (error) {
        this.logger.warn(`Yerel veri temizlenemedi: ${adapter.collection}`, error);
      }
    }
    this.clearCursors();
    return this.syncAll();
  }

  /**
   * Yerel veriyi hiçbir yere göndermeden siler (çıkış akışı).
   * Sunucu yapılandırılmamış olsa bile çalışır.
   */
  async clearLocalData(): Promise<void> {
    for (const adapter of this.adapters) {
      try {
        await adapter.clearLocal();
      } catch (error) {
        this.logger.warn(`Yerel veri temizlenemedi: ${adapter.collection}`, error);
      }
    }
    this.clearCursors();
  }

  /**
   * Tüm imleçleri sıfırlar — bir sonraki senkronda her şey baştan taşınır.
   *
   * Kimlik değiştiğinde (giriş/çıkış) çağrılır: imleçler önceki kullanıcıya
   * aitti, korunursa yeni hesabın verisi eksik inerdi.
   */
  resetCursors(): void {
    this.clearCursors();
    this.emit({ lastSyncAt: 0, phase: 'idle', error: undefined, conflictCount: 0 });
  }

  private clearCursors(): void {
    for (const adapter of this.adapters) {
      this.storage.delete(`${CURSOR_PREFIX}${adapter.collection}`);
    }
    this.storage.delete(LAST_SYNC_KEY);
  }

  private emit(partial: Partial<SyncStatus>): void {
    this.status = { ...this.status, ...partial };
    this.listeners.forEach(listener => listener(this.status));
  }

  private readCursor(collection: string): number {
    const raw = this.storage.getString(`${CURSOR_PREFIX}${collection}`);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private writeCursor(collection: string, cursor: number): void {
    this.storage.set(`${CURSOR_PREFIX}${collection}`, String(cursor));
  }

  private readLastSync(): number {
    const value = Number(this.storage.getString(LAST_SYNC_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  private writeLastSync(at: number): void {
    this.storage.set(LAST_SYNC_KEY, String(at));
  }
}

/** Hatayı kullanıcıya gösterilebilir kısa bir metne çevirir. */
const describe = (error: unknown): string => {
  const message = error instanceof Error ? error.message : String(error);
  return message.length > 140 ? `${message.slice(0, 137)}…` : message;
};
