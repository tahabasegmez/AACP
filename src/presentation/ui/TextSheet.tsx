import React from 'react';
import { ScrollView } from 'react-native';
import { stripHtml } from '@core/utils';
import { useTheme } from '../theme';
import { BottomSheet } from './BottomSheet';
import { Text } from './Text';

/**
 * TextSheet — başlık + uzun (HTML olabilen) metni aşağıdan kayan panelde gösterir.
 * Bölüm notları ve şov açıklaması gibi yerlerde ortak kullanılır (ortak BottomSheet).
 */
export const TextSheet: React.FC<{
  visible: boolean;
  title: string;
  text: string;
  onClose: () => void;
}> = ({ visible, title, text, onClose }) => {
  const theme = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <Text variant="heading" style={{ paddingHorizontal: theme.spacing(2.5) }}>
        {title}
      </Text>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(2.5), paddingTop: theme.spacing(1.5) }}>
        <Text variant="body" color={theme.colors.textMuted}>
          {stripHtml(text)}
        </Text>
      </ScrollView>
    </BottomSheet>
  );
};
