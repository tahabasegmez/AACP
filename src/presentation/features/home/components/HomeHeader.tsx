import React from 'react';
import { Image, useWindowDimensions, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO } from '../../../ui';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
const LOGO_HEIGHT = 56;

/**
 * HomeHeader — ana sayfanın markalı başlığı.
 *
 * Marka mavisinden tema zeminine dikey degrade; telefonun EN üstünden (Dynamic
 * Island / status bar arkası dahil) ve kenardan kenara dolar. Degrade'e AÇIK
 * genişlik (ekran genişliği) verilir — LinearGradient yalnızca flex-stretch ile
 * güvenilir biçimde yana yayılmıyor (New Architecture). "AA PODCAST" logosu sol
 * üstte, kaynak oranı korunarak kompakt gösterilir.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  return (
    <LinearGradient
      colors={[theme.colors.brand, theme.colors.elevated, theme.colors.bg]}
      locations={[0, 0.6, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        width,
        paddingTop: insets.top + theme.spacing(1.5),
        paddingBottom: theme.spacing(4),
        paddingHorizontal: theme.spacing(2.5),
      }}>
      <View style={{ alignItems: 'flex-start' }}>
        <Image
          source={AA_LOGO}
          resizeMode="contain"
          accessibilityRole="header"
          accessibilityLabel="AA Podcast"
          style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT }}
        />
      </View>
    </LinearGradient>
  );
};
