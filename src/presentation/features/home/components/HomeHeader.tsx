import React from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO } from '../../../ui';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
const LOGO_HEIGHT = 44;

/**
 * HomeHeader — ana sayfanın başlığı. Diğer sekmelerdeki ScreenHeader kontrolüyle
 * aynı yapı (satır + sabit boşluklar), farkı: başlık metni yerine "AA PODCAST"
 * logosu ve marka mavisi zemin. Solid backgroundColor kenardan kenara güvenilir
 * dolar; üst güvenli alan header'ın içine alındığı için mavi, Dynamic Island /
 * status bar arkasına kadar uzanır.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: theme.colors.brand,
        paddingHorizontal: theme.spacing(2),
        paddingTop: insets.top + theme.spacing(1),
        paddingBottom: theme.spacing(1.5),
      }}>
      <Image
        source={AA_LOGO}
        resizeMode="contain"
        accessibilityRole="header"
        accessibilityLabel="AA Podcast"
        style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT }}
      />
    </View>
  );
};
