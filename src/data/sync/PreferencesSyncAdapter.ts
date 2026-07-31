import { KeyValueStorage } from '@core/ports';
import { PreferenceKey, StoredPreference } from '@domain/entities';
import {
  PREFERENCES_STORAGE_KEY,
  StoredPreferences,
} from '../repositories/PreferencesRepositoryImpl';
import { SyncCollection, SyncCollectionAdapter, SyncRecord } from './SyncTypes';

/**
 * PreferencesSyncAdapter — tercihlerin senkron adaptörü.
 *
 * Her tercih AYRI bir kayıttır (anahtar = tercih adı). Böylece iki cihaz farklı
 * tercihleri değiştirdiğinde ikisi de korunur; tek bir blob olsaydı sonradan
 * senkronlanan diğerini sessizce geri alırdı.
 *
 * Silme senaryosu yoktur: bir tercih "silinmez", varsayılana döner. Yine de
 * tombstone gelirse kayıt yerelden düşer ve varsayılan geçerli olur.
 */
export class PreferencesSyncAdapter implements SyncCollectionAdapter {
  readonly collection: SyncCollection = 'preferences';

  constructor(private readonly storage: KeyValueStorage) {}

  async localChanges(since: number): Promise<readonly SyncRecord[]> {
    const all = this.read();
    return (Object.keys(all) as PreferenceKey[])
      .map(key => ({ key, entry: all[key] }))
      .filter((item): item is { key: PreferenceKey; entry: StoredPreference } =>
        !!item.entry && item.entry.updatedAt > since,
      )
      .map(({ key, entry }) => ({
        key,
        value: JSON.stringify(entry.value),
        updatedAt: entry.updatedAt,
        deleted: false,
      }));
  }

  async applyRemote(records: readonly SyncRecord[]): Promise<void> {
    const all = this.read();
    let changed = false;

    for (const record of records) {
      const key = record.key as PreferenceKey;
      const existing = all[key];
      // Yerelde daha yeni bir değer varsa uzak veri yok sayılır.
      if (existing && record.updatedAt <= existing.updatedAt) {
        continue;
      }

      if (record.deleted) {
        delete all[key];
        changed = true;
        continue;
      }

      const value = parseValue(record.value);
      if (value !== undefined) {
        all[key] = { value, updatedAt: record.updatedAt };
        changed = true;
      }
    }

    if (changed) {
      this.storage.set(PREFERENCES_STORAGE_KEY, JSON.stringify(all));
    }
  }

  async clearLocal(): Promise<void> {
    this.storage.delete(PREFERENCES_STORAGE_KEY);
  }

  private read(): StoredPreferences {
    const raw = this.storage.getString(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      return parsed && typeof parsed === 'object' ? (parsed as StoredPreferences) : {};
    } catch {
      return {};
    }
  }
}

/** Uzak değeri çözer; bozuk kayıt yerel tercihi kirletmesin. */
const parseValue = (json: string): StoredPreference['value'] | undefined => {
  try {
    const parsed = JSON.parse(json) as unknown;
    return typeof parsed === 'boolean' ? parsed : undefined;
  } catch {
    return undefined;
  }
};
