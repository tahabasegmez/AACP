import { toBackdropColor } from '@core/utils';
import { ImagePalette } from '@core/ports';
import { HashImagePalette } from './HashImagePalette';

/** react-native-image-colors v1 sonucundan (platforma göre) uygun rengi seçer. */
interface ColorsResult {
  platform?: string;
  background?: string;
  primary?: string;
  detail?: string;
  secondary?: string;
  dominant?: string;
  vibrant?: string;
  average?: string;
}

interface ImageColorsModule {
  getColors: (uri: string, opts: object) => Promise<ColorsResult>;
}

const pickColor = (res: ColorsResult): string | null => {
  switch (res.platform) {
    case 'ios':
      return res.background ?? res.detail ?? res.primary ?? null;
    case 'android':
      return res.dominant ?? res.vibrant ?? res.average ?? null;
    default:
      return res.dominant ?? res.vibrant ?? res.background ?? null;
  }
};

/**
 * ImagePalette portunun react-native-image-colors (v1, EXPO'SUZ) implementasyonu.
 *
 * v1.5.x kendi native modülünü kullanır; expo-modules-core GEREKTİRMEZ (v2 gerektiriyordu
 * ve "ExpoModulesCore.h not found" derleme hatası veriyordu). Kapağın gerçek baskın
 * rengini çıkarır, arka plan için koyulaştırır. Modül lazy require ile yüklenir;
 * herhangi bir hata olursa deterministik hash rengine düşülür (crash yok).
 *
 * Native gereksinim: sadece `pod install` (Expo adımı yok).
 */
export class ImageColorsPalette implements ImagePalette {
  private readonly fallback = new HashImagePalette();

  async getDominant(uri: string): Promise<string | null> {
    if (!uri) {
      return null;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const mod = require('react-native-image-colors') as {
        default?: ImageColorsModule;
      } & Partial<ImageColorsModule>;
      const impl = mod.default ?? (mod as ImageColorsModule);
      const res = await impl.getColors(uri, { cache: true, key: uri, quality: 'low' });
      const raw = pickColor(res);
      const color = raw ? toBackdropColor(raw) : null;
      if (color) {
        return color;
      }
    } catch {
      // native yok/başarısız → sessizce fallback
    }
    return this.fallback.getDominant(uri);
  }
}
