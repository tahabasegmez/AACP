import React from 'react';
import { Pressable, View } from 'react-native';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Text } from '../../../ui';

const DEFAULT_W = 132;

/** ShowCard — kare kapak + başlık + yazar (ana sayfa / grid). */
export const ShowCard: React.FC<{
  show: Show;
  onPress: () => void;
  width?: number;
}> = ({ show, onPress, width = DEFAULT_W }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={show.title}
      style={{ width }}>
      <CoverImage uri={show.imageUrl} size={width} radius={theme.radius.lg} />
      <View style={{ marginTop: theme.spacing(1) }}>
        <Text variant="subtitle" numberOfLines={1}>
          {show.title}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
          {show.author}
        </Text>
      </View>
    </Pressable>
  );
};
