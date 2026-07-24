/**
 * Tasarım token'ları — tüm renk/ölçek değerleri TEK kaynak burada.
 *
 * Palet AA marka renklerine dayanır:
 *   - marka mavisi  #0032A1  (büyük dolgular, başlıklar)
 *   - koyu lacivert #232741  (yükseltilmiş yüzeyler)
 * Koyu zeminde küçük metin/ikonların WCAG-AA kontrastı için parlak accent
 *   #3374FF kullanılır (marka mavisi koyu zeminde yeterli kontrast vermez).
 *
 * Bileşenler bu token'lara ThemeProvider üzerinden erişir; sabit renk yazmaz.
 */

export const palette = {
  brand: '#0032A1',
  brandDark: '#232741',
} as const;

export interface ColorTokens {
  bg: string;
  surface: string;
  elevated: string;
  brand: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  text: string;
  textMuted: string;
  textDim: string;
  border: string;
  divider: string;
  overlay: string;
  success: string;
  warning: string;
  danger: string;
  skeleton: string;
}

/** Koyu tema (varsayılan). */
export const darkColors: ColorTokens = {
  bg: '#0A0C15',
  surface: '#141726',
  elevated: '#232741',
  brand: '#0032A1',
  accent: '#3374FF',
  accentSoft: 'rgba(51,116,255,0.14)',
  onAccent: '#FFFFFF',
  text: '#F4F6FC',
  textMuted: '#9AA0B4',
  textDim: '#565C72',
  border: '#23283A',
  divider: '#20243444', // yarı saydam ayraç
  overlay: 'rgba(0,0,0,0.6)',
  success: '#2FBF71',
  warning: '#E7A33E',
  danger: '#E5484D',
  skeleton: '#1C2033',
};

/** Açık tema. */
export const lightColors: ColorTokens = {
  bg: '#FFFFFF',
  surface: '#F4F6FA',
  elevated: '#EAEEF6',
  brand: '#0032A1',
  accent: '#0A44C9',
  accentSoft: 'rgba(10,68,201,0.10)',
  onAccent: '#FFFFFF',
  text: '#14171F',
  textMuted: '#5B6172',
  textDim: '#8A90A0',
  border: '#E4E7EF',
  divider: '#E9ECF3',
  overlay: 'rgba(0,0,0,0.4)',
  success: '#1E9E5A',
  warning: '#C77F1E',
  danger: '#D33A3F',
  skeleton: '#E7EAF1',
};

/** 8'lik grid tabanlı boşluk. spacing(2) = 16. Yarım adım desteklenir. */
export const spacing = (multiplier: number): number => 8 * multiplier;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  pill: 999,
} as const;

/** Tipografi ölçeği. allowFontScaling ile dinamik yazı boyutuna uyar. */
export const typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.4 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400', letterSpacing: 0 },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600', letterSpacing: 0 },
  subtitle: { fontSize: 13, lineHeight: 18, fontWeight: '600', letterSpacing: 0 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500', letterSpacing: 0 },
  label: { fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.8 },
} as const;

export type TypographyVariant = keyof typeof typography;

/** Animasyon süreleri (ms). */
export const duration = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;
