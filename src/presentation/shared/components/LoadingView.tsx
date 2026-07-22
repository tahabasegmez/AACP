import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTheme } from '../../theme';

/** LoadingView — tam ekran yüklenme göstergesi (tutarlı kullanım için). */
export const LoadingView: React.FC = () => {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.background,
      }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
};
