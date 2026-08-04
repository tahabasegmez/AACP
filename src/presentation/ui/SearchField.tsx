import React from 'react';
import { TextInput, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';

/**
 * SearchField — ortak arama kutusu (Ara, Kütüphane, şov ve liste detayları).
 *
 * Sağdaki `action` yuvası, kutuyla AYNI satırda duran bir eylem içindir
 * (ör. filtre paneli düğmesi). Kutunun kendisi esner, eylem sabit kalır;
 * böylece arama alanı her ekranda aynı yükseklikte ve hizada durur.
 */
export const SearchField: React.FC<{
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  /** Kutunun sağında gösterilecek eylem (ör. FilterMenu). */
  action?: React.ReactNode;
}> = ({ value, onChangeText, placeholder, action }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1),
        marginHorizontal: theme.spacing(2),
        marginBottom: theme.spacing(1),
      }}>
      <View
        style={{
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(1),
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radius.md,
          paddingHorizontal: theme.spacing(1.5),
        }}>
        <Icon name="search" size={18} color={theme.colors.textMuted} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.colors.textMuted}
          style={{
            flex: 1,
            color: theme.colors.text,
            paddingVertical: theme.spacing(1.25),
            fontSize: 15,
          }}
          returnKeyType="search"
          autoCorrect={false}
          clearButtonMode="while-editing"
        />
      </View>
      {action}
    </View>
  );
};
