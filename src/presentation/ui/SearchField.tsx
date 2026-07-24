import React from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/**
 * SearchField — ortak arama kutusu (Ara ve Kütüphane aynı hizada kullansın).
 */
export const SearchField: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}> = ({ value, onChangeText, placeholder }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1),
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.md,
        paddingHorizontal: theme.spacing(1.5),
        marginHorizontal: theme.spacing(2),
        marginBottom: theme.spacing(1),
      }}>
      <Icon name="search" size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={{ flex: 1, color: theme.colors.text, paddingVertical: theme.spacing(1.25), fontSize: 15 }}
        returnKeyType="search"
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
    </View>
  );
};
