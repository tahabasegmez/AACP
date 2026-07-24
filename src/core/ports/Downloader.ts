/**
 * Downloader — dosya indirme/silme için teknik port.
 *
 * Domain anlamı taşımaz; core'da durur. `data` bu arayüze göre yazılır,
 * `infrastructure/download` somut implementasyonu (react-native-blob-util) sağlar.
 * Böylece indirme motorunu değiştirmek istersek tek dosya değişir.
 */
export interface Downloader {
  /** İndirilenlerin saklanacağı dizin (mutlak yol). */
  downloadsDir(): string;
  /**
   * `url`'i `destPath`'e indirir. İlerleme 0..1 olarak `onProgress` ile bildirilir.
   * Hedef dizin yoksa oluşturulur.
   */
  download(url: string, destPath: string, onProgress?: (fraction: number) => void): Promise<void>;
  /** Dosyayı siler (yoksa sessiz geçer). */
  remove(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}
