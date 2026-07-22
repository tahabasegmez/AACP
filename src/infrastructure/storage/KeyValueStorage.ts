import { KeyValueStorage } from '@core/ports';

/**
 * KeyValueStorage portunun bellek-içi implementasyonu.
 *
 * İlk sürüm için yeterli; kalıcılık gerektiğinde react-native-mmkv tabanlı bir
 * implementasyonla (aynı arayüz) değiştirilir — çağıran kod değişmez.
 * Ayarlar, "son dinlenen konum", offline meta verisi gibi küçük veriler için.
 *
 * NOT: Bellek-içi olduğu için uygulama yeniden başlayınca sıfırlanır. MMKV
 * implementasyonu (mac aşaması) kalıcılığı sağlayacak.
 */
export class InMemoryKeyValueStorage implements KeyValueStorage {
  private readonly store = new Map<string, string>();

  getString(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  set(key: string, value: string): void {
    this.store.set(key, value);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}
