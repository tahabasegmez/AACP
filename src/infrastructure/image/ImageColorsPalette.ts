import { ImagePalette } from '@core/ports';
import { getColors } from 'react-native-image-colors';

/**
 * ImagePalette portunun react-native-image-colors implementasyonu.
 *
 * Kapak görselinin baskın/zemin rengini döner (platforma göre uygun alan seçilir).
 * Kütüphane cache'i açık; ayrıca başarısızlıkta null döner (çağıran marka rengine
 * düşer) — böylece native bir sorun UI'ı bozmaz.
 */
export class ImageColorsPalette implements ImagePalette {
  async getDominant(uri: string): Promise<string | null> {
    if (!uri) {
      return null;
    }
    try {
      const result = await getColors(uri, { cache: true, key: uri, quality: 'low' });
      switch (result.platform) {
        case 'ios':
          return result.background ?? result.primary ?? result.detail ?? null;
        case 'android':
          return result.dominant ?? result.vibrant ?? result.average ?? null;
        default:
          return result.dominant ?? result.vibrant ?? null;
      }
    } catch {
      return null;
    }
  }
}
