/**
 * KeyValueStorage — kalıcı anahtar/değer depolama sözleşmesi (teknik port).
 *
 * Domain anlamı taşımaz; core'da durur. `data` bu arayüze göre yazılır,
 * `infrastructure/storage` somut implementasyonu (bugün bellek-içi, ileride
 * react-native-mmkv) sağlar. app katmanı ikisini birbirine bağlar.
 *
 * Senkron API bilinçli tercih: MMKV senkron çalışır ve küçük ayar/konum verileri
 * için async karmaşasına gerek yoktur.
 */
export interface KeyValueStorage {
  getString(key: string): string | null;
  set(key: string, value: string): void;
  delete(key: string): void;
}
