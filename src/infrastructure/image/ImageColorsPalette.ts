import { toBackdropColor } from '@core/utils';
import { ImagePalette } from '@core/ports';
import { HashImagePalette } from './HashImagePalette';

/** react-native-image-colors sonucundan (platforma göre) uygun rengi seçer. */
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
 * ImagePalette portunun react-native-image-colors implementasyonu (GERÇEK renk).
 *
 * Kapağın baskın rengini çıkarır ve arka plan için koyulaştırır (üstteki beyaz
 * metin okunur kalsın). Modül lazy require ile yüklenir; native/Expo kurulu
 * değilse HATA YUTULUR ve deterministik hash rengine düşülür (crash yok, uygulama
 * çalışmaya devam eder). Böylece "gerçek renk" ile "her koşulda çalışır" bir arada.
 *
 * Native gereksinim: react-native-image-colors + expo-modules-core
 * (mac: `npx install-expo-modules` + pod install). Bkz. docs/IOS_SETUP.md.
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
        getColors: (u: string, opts: object) => Promise<ColorsResult>;
      };
      const res = await mod.getColors(uri, { cache: true, key: uri, quality: 'low' });
      const raw = pickColor(res);
      const color = raw ? toBackdropColor(raw) : null;
      if (color) {
        return color;
      }
    } catch {
      // native/expo yok → sessizce fallback
    }
    return this.fallback.getDominant(uri);
  }
}
