import {
  ColorTokens,
  darkColors,
  duration,
  lightColors,
  radius,
  spacing,
  typography,
} from './tokens';

/**
 * Theme — bileşenlerin tükettiği çözülmüş tasarım sistemi.
 *
 * `colors` içinde token'lara ek olarak birkaç geriye-dönük alias (primary,
 * background) tutulur; eski ekranlar kırılmadan yeni sisteme geçebilsin diye.
 * Yeni kod doğrudan token isimlerini kullanmalı (bg, accent, textMuted...).
 */
export interface Theme {
  readonly dark: boolean;
  readonly colors: ColorTokens & {
    /** @deprecated accent kullan */
    readonly primary: string;
    /** @deprecated bg kullan */
    readonly background: string;
  };
  readonly spacing: (multiplier: number) => number;
  readonly radius: typeof radius;
  readonly typography: typeof typography;
  readonly duration: typeof duration;
}

const build = (dark: boolean, colors: ColorTokens): Theme => ({
  dark,
  colors: { ...colors, primary: colors.accent, background: colors.bg },
  spacing,
  radius,
  typography,
  duration,
});

export const darkTheme = build(true, darkColors);
export const lightTheme = build(false, lightColors);
