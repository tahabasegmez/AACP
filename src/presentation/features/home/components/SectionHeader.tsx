import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../../theme';
import { Icon, Text } from '../../../ui';

/**
 * SectionHeader — carousel başlığı. Başlığa/ok'a dokununca tam liste açılır (onSeeAll).
 */
export const SectionHeader: React.FC<{
  title: string;
  onSeeAll?: () => void;
}> = ({ title, onSeeAll }) => {
  const theme = useTheme();
  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: theme.spacing(2),
        paddingBottom: theme.spacing(1.25),
      }}>
      <Text variant="heading">{title}</Text>
      {onSeeAll && (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text variant="caption" color={theme.colors.textMuted}>
            Tümü
          </Text>
          <Icon name="chevron-right" size={16} color={theme.colors.textMuted} />
        </View>
      )}
    </View>
  );

  if (!onSeeAll) {
    return content;
  }
  return (
    <Pressable
      onPress={onSeeAll}
      accessibilityRole="button"
      accessibilityLabel={`${title} — tümünü gör`}
      hitSlop={8}>
      {content}
    </Pressable>
  );
};
