import React from 'react';
import { Image, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO } from '../../../ui';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
const LOGO_HEIGHT = 58;

/**
 * HomeHeader — ana sayfanın markalı başlığı. Marka mavisinden tema zeminine
 * dikey degrade, telefonun EN üstünden (Dynamic Island / status bar arkası dahil)
 * başlar; içerik güvenli alanın altına konumlanır. "AA PODCAST" logosu sol üstte,
 * kaynak oranı korunarak kompakt gösterilir.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[theme.colors.brand, theme.colors.elevated, theme.colors.bg]}
      locations={[0, 0.55, 1]}
      style={{
        paddingTop: insets.top + theme.spacing(1.5),
        paddingBottom: theme.spacing(3.5),
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
