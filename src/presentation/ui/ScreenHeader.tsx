import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Text } from './Text';

/**
 * ScreenHeader — tüm sekmelerde AYNI hizada duran ortak başlık.
 * Sol başlık + opsiyonel sağ aksiyon (ör. ayarlar). Sabit dikey boşluklar
 * sayesinde sekmeler arası geçişte başlık zıplamaz.
 */
export const ScreenHeader: React.FC<{
  title: string;
  right?: React.ReactNode;
}> = ({ title, right }) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 44,
        paddingHorizontal: theme.spacing(2),
        paddingTop: theme.spacing(1),
        paddingBottom: theme.spacing(1),
      }}>
      <Text variant="title">{title}</Text>
      {right ?? null}
    </View>
  );
};
