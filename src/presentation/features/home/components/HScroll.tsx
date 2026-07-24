import React from 'react';
import { ScrollView } from 'react-native';
import { useTheme } from '../../../theme';

/**
 * HScroll — yatay kaydırılabilir kart şeridi. Kartlar arasında tutarlı boşluk
 * ve kenar dolgusu verir. (Kart sayısı az olduğundan ScrollView yeterli; uzun
 * dikey listelerde FlashList kullanılır.)
 */
export const HScroll: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const theme = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: theme.spacing(2),
        gap: theme.spacing(1.5),
      }}>
      {children}
    </ScrollView>
  );
};
