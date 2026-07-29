import React from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO, headerMetrics } from '../../../ui';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
/** Başlık satırına sığacak logo yüksekliği (minHeight'i taşırmaz). */
const LOGO_HEIGHT = 34;

/**
 * HomeHeader — ana sayfanın SABİT başlığı (kaydırılınca kaybolmaz).
 *
 * Dikey ölçüler `headerMetrics`ten gelir — Ara/Kütüphane'deki ScreenHeader ile
 * AYNI kaynak. Bu sayede sekmeler arasında geçerken başlığın ALT HİZASI birebir
 * aynı yerde kalır ve içerik zıplamaz. Fark yalnızca içerikte: başlık metni
 * yerine ORTALANMIŞ "AA PODCAST" logosu ve marka mavisi zemin.
 *
 * Üst güvenli alan header'ın içine alınır; böylece mavi, Dynamic Island /
 * status bar arkasına kadar kenardan kenara dolar.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: theme.colors.brand,
        paddingTop: insets.top + headerMetrics.paddingTop,
        paddingBottom: headerMetrics.paddingBottom,
        paddingHorizontal: headerMetrics.paddingHorizontal,
      }}>
      <View
        style={{
          minHeight: headerMetrics.minHeight,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
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
