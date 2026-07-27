/**
 * ImagePicker — cihazdan görsel seçme PORTU.
 *
 * Playlist kapağı gibi kullanıcı görselleri için kullanılır. Port arkasında
 * durmasının sebebi: görsel seçici native bir bağımlılıktır ve platformlar
 * arasında değişir; UI yalnızca "bir görsel URI'si ver" der.
 *
 * `available` false ise özellik UI'da gizlenir/pasifleşir — uygulama yine
 * çalışır (kapaksız liste oluşturulabilir).
 */
export interface ImagePicker {
  /** Seçici kullanılabilir mi (native modül kurulu mu). */
  readonly available: boolean;
  /**
   * Kullanıcıya galeriyi açar ve seçilen görselin URI'sini döner.
   * İptal edilirse veya seçici yoksa `null` döner (hata DEĞİL).
   */
  pick(): Promise<string | null>;
}
