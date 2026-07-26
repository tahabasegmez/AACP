import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../../theme';
import { Screen, ScreenHeader, Text } from '../../../ui';

/**
 * SettingsScreen — Ayarlar. Tema koyuya sabit ve uygulama-içi animasyon ayarı
 * kaldırıldığı için şimdilik yalnızca uygulama bilgisi. İleride yeni ayarlar
 * (indirme kalitesi, uyku vb.) buraya eklenebilir.
 */
export const SettingsScreen: React.FC = () => {
  const theme = useTheme();
  return (
    <Screen>
      <ScreenHeader title="Ayarlar" />
      <View style={{ padding: theme.spacing(2) }}>
        <Text variant="heading">Anadolu Ajansı Podcast</Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: theme.spacing(0.5) }}>
          Anadolu Ajansı podcast'lerini dinle.
        </Text>
      </View>
    </Screen>
  );
};
