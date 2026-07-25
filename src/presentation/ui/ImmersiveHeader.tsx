import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Text } from './Text';

/**
 * ImmersiveHeader — native header yerine geçen, tam ekran (island'a kadar) üst
 * başlık: yazısız/dairesiz geri tuşu + başlık. Native header'ın "çizgi + safe-area
 * boşluğu" sorununu ortadan kaldırır; içerik en üstten başlar.
 */
export const ImmersiveHeader: React.FC<{
  title: string;
  onBack: () => void;
}> = ({ title, onBack }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        paddingTop: insets.top + theme.spacing(1),
        paddingBottom: theme.spacing(1),
        paddingHorizontal: theme.spacing(1.5),
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1),
      }}>
      <Pressable onPress={onBack} hitSlop={16} accessibilityRole="button" accessibilityLabel="Geri">
        <Icon name="chevron-back" size={28} color={theme.colors.text} />
      </Pressable>
      <Text variant="heading" numberOfLines={1} style={{ flex: 1 }}>
        {title}
      </Text>
    </View>
  );
};
