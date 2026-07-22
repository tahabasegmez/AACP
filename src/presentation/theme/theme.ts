/**
 * Uygulama teması — renk, boşluk ve tipografi token'ları tek yerde.
 * Bileşenler sabit değer yazmak yerine bu token'ları kullanır (tutarlılık + kolay değişim).
 */
export interface Theme {
  readonly colors: {
    readonly background: string;
    readonly surface: string;
    readonly primary: string;
    readonly text: string;
    readonly textMuted: string;
    readonly border: string;
  };
  readonly spacing: (multiplier: number) => number;
  readonly radius: { readonly sm: number; readonly md: number; readonly lg: number };
}

const baseSpacing = 8;

export const lightTheme: Theme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F4F5F7',
    primary: '#C8102E', // AA kurumsal kırmızısı (placeholder — doğrulanacak)
    text: '#111417',
    textMuted: '#6B7280',
    border: '#E5E7EB',
  },
  spacing: (m: number) => baseSpacing * m,
  radius: { sm: 6, md: 12, lg: 20 },
};

export const darkTheme: Theme = {
  ...lightTheme,
  colors: {
    background: '#0B0E11',
    surface: '#161A1F',
    primary: '#E23A50',
    text: '#F3F4F6',
    textMuted: '#9CA3AF',
    border: '#252A31',
  },
};
