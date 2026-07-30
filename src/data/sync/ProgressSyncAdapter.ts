import { KeyValueStorage } from '@core/ports';
import { PlaybackProgress } from '@domain/entities';
import { SyncCollection, SyncCollectionAdapter, SyncRecord } from './SyncTypes';

/** PlaybackProgressRepositoryImpl ile AYNI anahtar — tek veri kaynağı. */
const STORAGE_KEY = 'playback_progress_v1';

/**
 * ProgressSyncAdapter — "kaldığın yer" kayıtlarının senkron adaptörü.
 *
 * Bu koleksiyon senkron için doğal olarak hazırdır: her `PlaybackProgress`
 * zaten bir `updatedAt` (ISO) taşır, dolayısıyla ek meta veriye gerek yoktur.
 * Çakışma çözümü son-yazan-kazanır: daha yeni damgalı kayıt geçerlidir.
 *
 * Silme senaryosu yok sayılır (bir bölümü "dinlemeye devam"dan çıkarmak şu an
 * bir kullanıcı eylemi değil); tombstone gelirse yerelden silinir.
 */
export class ProgressSyncAdapter implements SyncCollectionAdapter {
  readonly collection: SyncCollection = 'progress';

  constructor(private readonly storage: KeyValueStorage) {}

  async localChanges(since: number): Promise<readonly SyncRecord[]> {
    const all = this.read();
    return Object.values(all)
      .filter(p => toEpoch(p.updatedAt) > since)
      .map(p => ({
        key: p.episodeId,
        value: JSON.stringify(p),
        updatedAt: toEpoch(p.updatedAt),
        deleted: false,
      }));
  }

  async clearLocal(): Promise<void> {
    this.storage.delete(STORAGE_KEY);
  }

  async applyRemote(records: readonly SyncRecord[]): Promise<void> {
    const all = this.read();
    let changed = false;

    for (const record of records) {
      const existing = all[record.key];
      const existingAt = existing ? toEpoch(existing.updatedAt) : 0;
      // Yerelde daha yeni bir kayıt varsa uzak veri yok sayılır.
      if (record.updatedAt <= existingAt) {
        continue;
      }

      if (record.deleted) {
        delete all[record.key];
        changed = true;
        continue;
      }

      const parsed = parseProgress(record.value);
      if (parsed) {
        // Anahtar DAİMA kaydın kendi bölüm kimliğidir. Uzak anahtara güvenmek
        // (eski/bozuk bir anahtar gelirse) aynı bölüm için iki kayıt oluşturur
        // ve "Dinlemeye devam" listesinde çift görünürdü.
        delete all[record.key];
        all[parsed.episodeId] = parsed;
        changed = true;
      }
    }

    if (changed) {
      this.storage.set(STORAGE_KEY, JSON.stringify(all));
    }
  }

  private read(): Record<string, PlaybackProgress> {
    const raw = this.storage.getString(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as Record<string, PlaybackProgress>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
}

/** ISO zaman damgasını epoch ms'e çevirir; geçersizse 0. */
const toEpoch = (iso: string | undefined): number => {
  if (!iso) {
    return 0;
  }
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
};

/** Uzak veriyi doğrular — bozuk kayıt yerel depoyu kirletmesin. */
const parseProgress = (json: string): PlaybackProgress | null => {
  try {
    const parsed = JSON.parse(json) as PlaybackProgress;
    if (
      parsed &&
      typeof parsed.episodeId === 'string' &&
      typeof parsed.positionSec === 'number' &&
      typeof parsed.durationSec === 'number'
    ) {
      return parsed;
    }
  } catch {
    /* bozuk kayıt atlanır */
  }
  return null;
};
