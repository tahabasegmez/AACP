import React from 'react';
import { View } from 'react-native';
import { headerMetrics } from './headerMetrics';
import { Text } from './Text';

/**
 * ScreenHeader — tüm sekmelerde AYNI hizada duran ortak başlık.
 *
 * Sol tarafta başlık metni ya da özel bir içerik (ör. ana sayfanın logosu),
 * sağ tarafta opsiyonel bir eylem bulunur. Ölçüler `headerMetrics`ten gelir;
 * ana sayfanın logolu başlığı da bu bileşeni kullanır, bu sayede sekmeler
 * arası geçişte hem başlığın alt hizası hem sağdaki eylemin yeri ve boyutu
 * birebir aynı kalır.
 */
export const ScreenHeader: React.FC<{
  /** Sol taraftaki başlık metni. `left` verilmişse yok sayılır. */
  title?: string;
  /** Başlık metni yerine gösterilecek içerik (logo gibi). */
  left?: React.ReactNode;
  /** Sağdaki eylem — ölçüsü `headerMetrics.actionSize` olmalıdır. */
  right?: React.ReactNode;
}> = ({ title, left, right }) => {
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
      {left ?? <Text variant="title">{title}</Text>}
      {right ?? null}
    </View>
  );
};
