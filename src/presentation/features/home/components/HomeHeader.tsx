import React from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO } from '../../../ui';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
const LOGO_HEIGHT = 34;

/**
 * HomeHeader — ana sayfanın SABİT başlığı (kaydırılınca kaybolmaz).
 *
 * Diğer sekmelerdeki ScreenHeader ile AYNI dikey metrikler (minHeight 44 + eşit
 * boşluklar) kullanılır; böylece alt hizası Ara/Kütüphane başlıklarıyla aynı
 * satırda durur ve sekme geçişinde zıplama olmaz. Fark: başlık metni yerine
 * "AA PODCAST" logosu ve marka mavisi solid zemin — üst güvenli alan içeri
 * alındığı için mavi, Dynamic Island / status bar arkasına kadar dolar.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: theme.colors.brand,
        paddingTop: insets.top + theme.spacing(1),
        paddingBottom: theme.spacing(1),
        paddingHorizontal: theme.spacing(2),
      }}>
      <View style={{ minHeight: 44, justifyContent: 'center' }}>
        <Image
          source={AA_LOGO}
          resizeMode="contain"
          accessibilityRole="header"
          accessibilityLabel="AA Podcast"
          style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT }}
        />
      </View>
    </View>
  );
};
