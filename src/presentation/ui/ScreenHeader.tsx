import React from 'react';
import { View } from 'react-native';
import { headerMetrics } from './headerMetrics';
import { Text } from './Text';

/**
 * ScreenHeader — tüm sekmelerde AYNI hizada duran ortak başlık.
 * Sol başlık + opsiyonel sağ aksiyon (ör. ayarlar). Ölçüler `headerMetrics`ten
 * gelir; ana sayfanın logolu başlığı da aynı kaynağı kullanır, bu sayede
 * sekmeler arası geçişte başlığın alt hizası kaymaz.
 */
export const ScreenHeader: React.FC<{
  title: string;
  right?: React.ReactNode;
}> = ({ title, right }) => {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: headerMetrics.minHeight,
        paddingHorizontal: headerMetrics.paddingHorizontal,
        paddingTop: headerMetrics.paddingTop,
        paddingBottom: headerMetrics.paddingBottom,
      }}>
      <Text variant="title">{title}</Text>
      {right ?? null}
    </View>
  );
};
