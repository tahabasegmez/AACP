import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

/**
 * Screen — ekranların ortak kabuğu: tema zemini + güvenli alan (üst).
 * Alt güvenli alan genellikle tab bar / mini player tarafından yönetilir; bu
 * yüzden varsayılan olarak yalnızca üst inset uygulanır.
 */
export const Screen: React.FC<{
  children: React.ReactNode;
  edges?: { top?: boolean; bottom?: boolean };
  style?: ViewStyle;
}> = ({ children, edges = { top: true }, style }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: theme.colors.bg,
          paddingTop: edges.top ? insets.top : 0,
          paddingBottom: edges.bottom ? insets.bottom : 0,
        },
        style,
      ]}>
      {children}
    </View>
  );
};
