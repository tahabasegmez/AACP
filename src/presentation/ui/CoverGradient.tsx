import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../theme';
import { useCoverColor } from '../query/useCoverColor';

/**
 * CoverGradient — kapak görselinin baskın renginden tema zeminine geçen degrade.
 * Player ve şov detayı gibi ekranlarda arka planı kapağa göre renklendirmek için
 * TEK yerde tanımlı; her kullanan aynı bileşeni çağırır.
 */
export const CoverGradient: React.FC<{
  uri?: string;
  style?: StyleProp<ViewStyle>;
  /** Renk duraklar (0..1). Varsayılan: üstte kapak rengi, ortada karışım, altta bg. */
  locations?: [number, number, number];
  children?: React.ReactNode;
}> = ({ uri, style, locations = [0, 0.5, 1], children }) => {
  const theme = useTheme();
  const color = useCoverColor(uri);

  return (
    <LinearGradient
      colors={[color, theme.colors.elevated, theme.colors.bg]}
      locations={locations}
      style={style}>
      {children}
    </LinearGradient>
  );
};
