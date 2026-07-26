import React from 'react';
import { Image } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO } from '../../../ui';

/**
 * HomeHeader — ana sayfanın üstündeki markalı başlık: AA PODCAST logosu, arkasında
 * canlı maviden (marka) tema zeminine geçen degrade. Island'lı telefonlarda en
 * üste kadar (safe-area dahil) dolar.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <LinearGradient
      colors={[theme.colors.brand, theme.colors.bg]}
      locations={[0, 1]}
      style={{
        paddingTop: insets.top + theme.spacing(1),
        paddingBottom: theme.spacing(3),
        paddingHorizontal: theme.spacing(2),
        alignItems: 'flex-start',
      }}>
      <Image
        source={AA_LOGO}
        resizeMode="contain"
        accessibilityRole="header"
        accessibilityLabel="AA Podcast"
        style={{ width: 116, height: 40 }}
      />
    </LinearGradient>
  );
};
