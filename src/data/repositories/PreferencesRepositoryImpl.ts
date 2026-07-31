import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import {
  PreferenceKey,
  Preferences,
  StoredPreference,
  mergePreferences,
} from '@domain/entities';
import { PreferencesRepository } from '@domain/repositories';

/** PreferencesSyncAdapter ile AYNI anahtar — tek veri kaynağı. */
export const PREFERENCES_STORAGE_KEY = 'preferences_v1';

/** Diskteki biçim: tercih adı → değer + değişiklik zamanı. */
export type StoredPreferences = Partial<Record<PreferenceKey, StoredPreference>>;

/**
 * PreferencesRepository'nin yerel implementasyonu.
 *
 * Tercihler ALAN BAZINDA saklanır (`{ hideCompletedEpisodes: { value, updatedAt } }`)
 * çünkü senkron çakışmaları alan bazında çözülür. Tek bir JSON blobu tutmak
 * daha kısa olurdu ama iki cihaz farklı tercihleri değiştirdiğinde biri
 * diğerini ezerdi.
 *
 * Misafir ve giriş yapmış kullanıcı için AYNI sınıf çalışır: fark yalnızca
 * verinin senkronlanıp senkronlanmadığıdır ve o karar bu sınıfın dışındadır.
 */
export class PreferencesRepositoryImpl implements PreferencesRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async get(): Promise<Result<Preferences>> {
    try {
      return ok(mergePreferences(this.read()));
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async set<K extends PreferenceKey>(
    key: K,
    value: Preferences[K],
  ): Promise<Result<void>> {
    try {
      const all = this.read();
      all[key] = { value, updatedAt: Date.now() };
      this.storage.set(PREFERENCES_STORAGE_KEY, JSON.stringify(all));
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  private read(): StoredPreferences {
    const raw = this.storage.getString(PREFERENCES_STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as StoredPreferences) : {};
  }
}
