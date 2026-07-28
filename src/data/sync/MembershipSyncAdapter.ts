import { KeyValueStorage } from '@core/ports';
import { SyncCollection, SyncCollectionAdapter, SyncRecord } from './SyncTypes';

/** Bir üyelik kaydının senkron meta verisi. */
interface MemberMeta {
  readonly updatedAt: number;
  readonly deleted: boolean;
}

/**
 * MembershipSyncAdapter — "üyelik listesi" tipindeki koleksiyonların senkronu
 * (takip edilen şovlar, sonra dinle).
 *
 * SORUN: Bu listeler yerelde yalnızca üyeleri tutar; ne değişiklik zamanı ne de
 * silme kaydı vardır. Senkron ikisini de gerektirir (yoksa bir cihazdaki silme
 * diğerine ulaşmaz).
 *
 * ÇÖZÜM: Domain verisine dokunmadan, yanında bir **gölge meta** haritası
 * (id → {updatedAt, deleted}) tutulur. Repository'ler değişmez; meta yalnızca
 * senkron katmanının iç ayrıntısıdır. Yerelde meta'sı olmayan bir üye ilk
 * görüldüğünde "şimdi eklendi" sayılır, böylece mevcut kullanıcı verisi
 * senkrona sorunsuz katılır.
 *
 * Üye yükünü (value) okuma/yazma işini alt sınıflar sağlar; böylece hem düz
 * id listesi (follows) hem de nesne listesi (saved) aynı mantığı paylaşır.
 */
export abstract class MembershipSyncAdapter<TItem> implements SyncCollectionAdapter {
  constructor(
    readonly collection: SyncCollection,
    protected readonly storage: KeyValueStorage,
    protected readonly listKey: string,
  ) {}

  /** Öğenin kararlı kimliği (senkron anahtarı). */
  protected abstract idOf(item: TItem): string;
  /** Uzaktan gelen JSON'u öğeye çevirir; geçersizse null. */
  protected abstract parse(json: string): TItem | null;

  protected get metaKey(): string {
    return `aacp.sync.meta.${this.collection}`;
  }

  async localChanges(since: number): Promise<readonly SyncRecord[]> {
    const items = this.readList();
    const meta = this.readMeta();
    const now = Date.now();
    let metaChanged = false;

    const records: SyncRecord[] = [];

    // Mevcut üyeler — meta'sı yoksa "şimdi eklendi" damgası verilir.
    for (const item of items) {
      const id = this.idOf(item);
      let entry = meta[id];
      if (!entry || entry.deleted) {
        entry = { updatedAt: now, deleted: false };
        meta[id] = entry;
        metaChanged = true;
      }
      if (entry.updatedAt > since) {
        records.push({
          key: id,
          value: JSON.stringify(item),
          updatedAt: entry.updatedAt,
          deleted: false,
        });
      }
    }

    // Listede olmayan ama meta'da duran üyeler = silinmiş (tombstone).
    const present = new Set(items.map(i => this.idOf(i)));
    for (const [id, entry] of Object.entries(meta)) {
      if (present.has(id)) {
        continue;
      }
      if (!entry.deleted) {
        meta[id] = { updatedAt: now, deleted: true };
        metaChanged = true;
      }
      const current = meta[id];
      if (current.updatedAt > since) {
        records.push({ key: id, value: '', updatedAt: current.updatedAt, deleted: true });
      }
    }

    if (metaChanged) {
      this.writeMeta(meta);
    }
    return records;
  }

  async applyRemote(records: readonly SyncRecord[]): Promise<void> {
    const items = this.readList();
    const meta = this.readMeta();
    const byId = new Map(items.map(i => [this.idOf(i), i]));
    let changed = false;

    for (const record of records) {
      const localAt = meta[record.key]?.updatedAt ?? 0;
      // Yerel kayıt daha yeniyse uzak veri yok sayılır (son yazan kazanır).
      if (record.updatedAt <= localAt) {
        continue;
      }

      if (record.deleted) {
        if (byId.delete(record.key)) {
          changed = true;
        }
        meta[record.key] = { updatedAt: record.updatedAt, deleted: true };
        changed = true;
        continue;
      }

      const parsed = this.parse(record.value);
      if (parsed) {
        byId.set(record.key, parsed);
        meta[record.key] = { updatedAt: record.updatedAt, deleted: false };
        changed = true;
      }
    }

    if (changed) {
      this.writeList([...byId.values()]);
      this.writeMeta(meta);
    }
  }

  async clearLocal(): Promise<void> {
    // Hem üye listesi hem gölge meta silinir; aksi halde eski tombstone'lar
    // yeni kimliğin verisini silmeye kalkardı.
    this.storage.delete(this.listKey);
    this.storage.delete(this.metaKey);
  }

  protected readList(): TItem[] {
    const raw = this.storage.getString(this.listKey);
    if (!raw) {
      return [];
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return Array.isArray(parsed) ? (parsed as TItem[]) : [];
    } catch {
      return [];
    }
  }

  protected writeList(items: readonly TItem[]): void {
    this.storage.set(this.listKey, JSON.stringify(items));
  }

  private readMeta(): Record<string, MemberMeta> {
    const raw = this.storage.getString(this.metaKey);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, MemberMeta>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }

  private writeMeta(meta: Record<string, MemberMeta>): void {
    this.storage.set(this.metaKey, JSON.stringify(meta));
  }
}
