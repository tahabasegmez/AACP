import { Result } from '@core/error';
import { PreferenceKey, Preferences } from '../entities';

/**
 * PreferencesRepository — tercihlerin okunup yazıldığı sözleşme.
 *
 * Yazma ALAN BAZINDADIR (`set(key, value)`), tümünü birden değiştiren bir
 * metot bilinçli olarak yoktur: tercihler cihazlar arasında senkronlanır ve
 * blok hâlinde yazmak, başka bir cihazda değiştirilmiş bir tercihi sessizce
 * geri alırdı.
 *
 * Depolamanın nerede olduğu (cihaz, NoSQL, ilişkisel veritabanı) bu arayüzün
 * dışındadır; implementasyon değişse de domain ve arayüz katmanı değişmez.
 */
export interface PreferencesRepository {
  /** Tüm tercihler; kaydedilmemiş olanlar varsayılana düşer. */
  get(): Promise<Result<Preferences>>;
  /** Tek bir tercihi yazar. */
  set<K extends PreferenceKey>(key: K, value: Preferences[K]): Promise<Result<void>>;
}
