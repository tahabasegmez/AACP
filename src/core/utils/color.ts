/**
 * Küçük renk yardımcıları — kapak renklerini arka planda güvenle kullanmak için.
 * (Örn. çok açık bir kapak rengini koyulaştırıp üstteki beyaz metni okunur tutmak.)
 */

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** #rrggbb / #rgb → {h,s,l} (0-360, 0-100, 0-100). Geçersizse null. */
export const hexToHsl = (hex: string): { h: number; s: number; l: number } | null => {
  let c = hex.trim().replace('#', '');
  if (c.length === 3) {
    c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  }
  if (!/^[0-9a-fA-F]{6}$/.test(c)) {
    return null;
  }
  const r = parseInt(c.slice(0, 2), 16) / 255;
  const g = parseInt(c.slice(2, 4), 16) / 255;
  const b = parseInt(c.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
  }
  return { h, s: s * 100, l: l * 100 };
};

export const hslToHex = (h: number, s: number, l: number): string => {
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

/**
 * Rengi arka plan için uygun aralığa çeker: çok açıksa koyulaştırır, doygunluğu
 * makul bir tabana yükseltir. Böylece üstteki beyaz metin her kapakta okunur kalır.
 */
export const toBackdropColor = (hex: string, maxLightness = 34, minSat = 30): string | null => {
  const hsl = hexToHsl(hex);
  if (!hsl) {
    return null;
  }
  const l = clamp(hsl.l, 12, maxLightness);
  const s = clamp(Math.max(hsl.s, minSat), 0, 70);
  return hslToHex(hsl.h, s, l);
};
