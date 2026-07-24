import React from 'react';
import { ScrollView } from 'react-native';
import { useTheme } from '../../../theme';
import { BottomSheet, Text } from '../../../ui';

const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * NotesSheet — bölüm notlarını aşağıdan kayan panelde gösterir (ortak BottomSheet).
 */
export const NotesSheet: React.FC<{
  visible: boolean;
  title: string;
  notes: string;
  onClose: () => void;
}> = ({ visible, title, notes, onClose }) => {
  const theme = useTheme();
  return (
    <BottomSheet visible={visible} onClose={onClose} maxHeightRatio={0.7}>
      <Text variant="heading" style={{ paddingHorizontal: theme.spacing(2.5) }}>
        {title}
      </Text>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(2.5), paddingTop: theme.spacing(1.5) }}>
        <Text variant="body" color={theme.colors.textMuted}>
          {stripHtml(notes)}
        </Text>
      </ScrollView>
    </BottomSheet>
  );
};
