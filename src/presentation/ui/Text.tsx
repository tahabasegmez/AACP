import React from 'react';
import { StyleProp, Text as RNText, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme';
import { TypographyVariant } from '../theme/tokens';

interface Props extends TextProps {
  variant?: TypographyVariant;
  /** Renk token'ı (ör. theme.colors.textMuted) veya ham renk. Verilmezse ana metin. */
  color?: string;
  /** label varyantı için otomatik BÜYÜK harf. */
  uppercase?: boolean;
  style?: StyleProp<TextStyle>;
}

/**
 * Text — tipografi ölçeğine bağlı temel metin bileşeni.
 * `allowFontScaling` varsayılan açık (dinamik yazı boyutu / erişilebilirlik).
 * Ekranlar sabit fontSize yazmaz; `variant` kullanır.
 */
export const Text: React.FC<Props> = ({
  variant = 'body',
  color,
  uppercase,
  style,
  children,
  ...rest
}) => {
  const theme = useTheme();
  const t = theme.typography[variant];
  return (
    <RNText
      style={[
        {
          fontSize: t.fontSize,
          lineHeight: t.lineHeight,
          fontWeight: t.fontWeight as TextStyle['fontWeight'],
          letterSpacing: t.letterSpacing,
          color: color ?? theme.colors.text,
          textTransform: uppercase ? 'uppercase' : undefined,
        },
        style,
      ]}
      {...rest}>
      {children}
    </RNText>
  );
};
