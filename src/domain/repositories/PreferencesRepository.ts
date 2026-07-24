import { Result } from '@core/error';
import { Preferences } from '../entities';

/**
 * PreferencesRepository — kullanıcı tercihlerini saklar (yerel).
 * PORT. Implementasyon `data` katmanında (KeyValueStorage → MMKV).
 */
export interface PreferencesRepository {
  get(): Promise<Result<Preferences>>;
  save(prefs: Preferences): Promise<Result<void>>;
}
