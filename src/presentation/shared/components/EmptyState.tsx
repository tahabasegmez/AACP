import React from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme';

/**
 * EmptyState — liste boş olduğunda gösterilen tutarlı bilgi görünümü.
 * "Aptal" bileşen: yalnızca başlık/açıklama prop'u alır.
 */
export const EmptyState: React.FC<{
  title: string;
  description?: string;
}> = ({ title, description }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.spacing(3),
        backgroundColor: theme.colors.background,
      }}>
      <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '600' }}>
        {title}
      </Text>
      {!!description && (
        <Text
          style={{
            color: theme.colors.textMuted,
            marginTop: theme.spacing(1),
            textAlign: 'center',
          }}>
          {description}
        </Text>
      )}
    </View>
  );
};
