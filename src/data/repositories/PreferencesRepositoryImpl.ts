import { AppError, Result, fail, ok } from '@core/error';
import { KeyValueStorage } from '@core/ports';
import { Preferences, normalizePreferences } from '@domain/entities';
import { PreferencesRepository } from '@domain/repositories';

const STORAGE_KEY = 'preferences_v1';

/**
 * PreferencesRepository'nin yerel implementasyonu (KeyValueStorage → MMKV).
 * Okurken eksik/eski alanları varsayılanlarla normalize eder.
 */
export class PreferencesRepositoryImpl implements PreferencesRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  async get(): Promise<Result<Preferences>> {
    try {
      const raw = this.storage.getString(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Partial<Preferences>) : null;
      return ok(normalizePreferences(parsed));
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }

  async save(prefs: Preferences): Promise<Result<void>> {
    try {
      this.storage.set(STORAGE_KEY, JSON.stringify(normalizePreferences(prefs)));
      return ok(undefined);
    } catch (error) {
      return fail(AppError.from(error, 'STORAGE'));
    }
  }
}
