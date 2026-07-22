import { KeyValueStorage } from '@core/ports';
import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * KeyValueStorage portunun react-native-mmkv tabanlı KALICI implementasyonu.
 *
 * MMKV hem iOS hem Android'de çalışan, hızlı, senkron bir depolamadır — bu yüzden
 * ileride Android'e geçtiğimizde bu adaptör AYNEN kullanılır, değişiklik gerekmez.
 * Platform bağımsızlığı `KeyValueStorage` portu sayesinde korunur: uygulamanın
 * geri kalanı MMKV'yi değil, arayüzü tanır.
 *
 * `id` ile ayrı bir "instance" (namespace) kullanıyoruz; farklı veri grupları
 * (ör. şifreli alan) ileride ayrı instance'lara alınabilir.
 */
export class MmkvKeyValueStorage implements KeyValueStorage {
  private readonly mmkv: MMKV;

  constructor(id = 'aacp') {
    // react-native-mmkv v4 (nitro): instance createMMKV ile üretilir.
    this.mmkv = createMMKV({ id });
  }

  getString(key: string): string | null {
    // MMKV bulunamayan anahtar için undefined döner; portumuz null bekliyor.
    return this.mmkv.getString(key) ?? null;
  }

  set(key: string, value: string): void {
    this.mmkv.set(key, value);
  }

  delete(key: string): void {
    // v4'te silme metodu remove (delete değil).
    this.mmkv.remove(key);
  }
}
