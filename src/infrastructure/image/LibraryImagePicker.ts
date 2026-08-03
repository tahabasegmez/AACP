import { ImagePickOptions, ImagePicker, PickedImage } from '@core/ports';
import { Logger } from '@core/logger';

/** react-native-image-picker'ın kullandığımız yüzeyi. */
interface ImagePickerModule {
  launchImageLibrary(options: {
    mediaType: 'photo';
    selectionLimit: number;
    includeBase64?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
  }): Promise<{
    didCancel?: boolean;
    errorCode?: string;
    assets?: Array<{ uri?: string; base64?: string; type?: string }>;
  }>;
}

/** Küçültülen görselin JPEG sıkıştırma kalitesi. */
const QUALITY = 0.85;

/**
 * LibraryImagePicker — ImagePicker portunun cihaz galerisi implementasyonu.
 *
 * Native modül (`react-native-image-picker`) KURULU DEĞİLSE uygulama çökmez:
 * modül gecikmeli (lazy) yüklenir, bulunamazsa seçici "kullanılamaz" olarak
 * işaretlenir ve görsel seçme özelliği UI'da sessizce pasifleşir. Bu sayede
 * paket kurulumu (ve iOS'ta `pod install`) ayrı bir adım olarak yapılabilir,
 * geri kalan her şey çalışmaya devam eder.
 *
 * Kurulum:
 *   npm i react-native-image-picker && npx pod-install
 * iOS için Info.plist'e `NSPhotoLibraryUsageDescription` eklenmelidir.
 */
export class LibraryImagePicker implements ImagePicker {
  private module?: ImagePickerModule;

  constructor(private readonly logger: Logger) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.module = require('react-native-image-picker') as ImagePickerModule;
    } catch {
      this.logger.info('Görsel seçici kurulu değil — görsel seçimi devre dışı');
    }
  }

  get available(): boolean {
    return typeof this.module?.launchImageLibrary === 'function';
  }

  async pick(options?: ImagePickOptions): Promise<PickedImage | null> {
    if (!this.module) {
      return null;
    }
    try {
      const result = await this.module.launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 1,
        includeBase64: options?.withData === true,
        // Küçültme yalnızca sınır verildiğinde uygulanır; verilmezse özgün
        // görsel korunur (kapak seçiminde kalite önemli).
        ...(options?.maxSize
          ? { maxWidth: options.maxSize, maxHeight: options.maxSize, quality: QUALITY }
          : {}),
      });
      if (result.didCancel || result.errorCode) {
        return null;
      }

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        return null;
      }
      return { uri: asset.uri, base64: asset.base64, contentType: asset.type };
    } catch (error) {
      this.logger.warn('Görsel seçilemedi', error);
      return null;
    }
  }
}
