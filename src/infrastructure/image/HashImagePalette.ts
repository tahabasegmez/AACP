import { ImagePalette } from '@core/ports';

/**
 * ImagePalette portunun native-dep'siz implementasyonu.
 *
 * Not: Gerçek piksel-renk çıkarımı (react-native-image-colors) Expo Modules
 * altyapısı gerektirdiği için, projeyi native-hafif tutmak adına burada kapak
 * URL'inden DETERMİNİSTİK bir renk türetiyoruz. Aynı kapak her zaman aynı,
 * hoş ve koyu-uyumlu bir renk alır → arka planlar şovdan şova değişir.
 * İleride gerçek piksel rengi istenirse yalnızca bu adaptör değişir (port sabit).
 */
export class HashImagePalette implements ImagePalette {
  async getDominant(uri: string): Promise<string | null> {
    if (!uri) {
      return null;
    }
    const hue = hashToHue(uri);
    // Koyu ve orta-doygun: üstte kapak rengi, tema zeminine yumuşak geçsin.
    return hslToHex(hue, 46, 30);
  }
}

const hashToHue = (str: string): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h % 360;
};

const hslToHex = (h: number, s: number, l: number): string => {
  const sn = s / 100;
  const ln = l / 100;
  const a = sn * Math.min(ln, 1 - ln);
  const f = (n: number): string => {
    const k = (n + h / 30) % 12;
    const color = ln - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
};
