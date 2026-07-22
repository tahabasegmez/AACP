/**
 * KeyValueStorage — kalıcı anahtar/değer depolama sözleşmesi + basit implementasyon.
 *
 * İlk sürümde bellek-içi implementasyon yeterli; kalıcılık gerektiğinde
 * react-native-mmkv tabanlı bir implementasyonla (aynı arayüz) değiştirilir.
 * Ayarlar, "son dinlenen konum", offline meta verisi gibi küçük veriler için.
 */
export interface KeyValueStorage {
  getString(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}

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
