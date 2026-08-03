/**
 * ImagePicker — cihazdan görsel seçme PORTU.
 *
 * Liste kapağı ve profil fotoğrafı gibi kullanıcı görselleri için kullanılır.
 * Port arkasında durmasının sebebi: görsel seçici native bir bağımlılıktır ve
 * platformlar arasında değişir; UI yalnızca "bir görsel ver" der.
 *
 * `available` false ise özellik UI'da gizlenir/pasifleşir — uygulama yine
 * çalışır (kapaksız liste oluşturulabilir).
 */
export interface ImagePicker {
  /** Seçici kullanılabilir mi (native modül kurulu mu). */
  readonly available: boolean;
  /**
   * Kullanıcıya galeriyi açar ve seçilen görseli döner.
   * İptal edilirse veya seçici yoksa `null` döner (hata DEĞİL).
   */
  pick(options?: ImagePickOptions): Promise<PickedImage | null>;
}

export interface ImagePickOptions {
  /**
   * Uzun kenar için üst sınır (px). Verilirse görsel seçilirken küçültülür.
   *
   * Küçültme SEÇİM ANINDA yapılır: 4000 px'lik bir fotoğrafı belleğe alıp
   * sonra küçültmek, düşük bellekli cihazlarda uygulamayı düşürebilirdi.
   */
  readonly maxSize?: number;
  /**
   * Görselin gövdesi de base64 olarak istensin mi.
   *
   * Yükleme için gerekir; yalnızca önizleme gösterilecekse istenmez — base64
   * gövdeyi bellekte ~%33 şişirir.
   */
  readonly withData?: boolean;
}

/** Seçilen görsel. */
export interface PickedImage {
  /** Cihaz üzerindeki adresi (önizleme için). */
  readonly uri: string;
  /** `withData` istendiyse gövdenin base64'ü. */
  readonly base64?: string;
  /** MIME türü, ör. `image/jpeg`. */
  readonly contentType?: string;
}
