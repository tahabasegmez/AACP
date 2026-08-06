import {
  ColorTokens,
  darkColors,
  duration,
  radius,
  spacing,
  typography,
} from './tokens';

/**
 * Theme — bileşenlerin tükettiği çözülmüş tasarım sistemi.
 *
 * Bileşenler token isimlerini doğrudan kullanır (bg, accent, textMuted...);
 * sabit renk yazılmaz.
 */
export interface Theme {
  readonly dark: boolean;
  readonly colors: ColorTokens;
  readonly spacing: (multiplier: number) => number;
  readonly radius: typeof radius;
  readonly typography: typeof typography;
  readonly duration: typeof duration;
}

const build = (dark: boolean, colors: ColorTokens): Theme => ({
  dark,
  colors,
  spacing,
  radius,
  typography,
  duration,
});

export const darkTheme = build(true, darkColors);
