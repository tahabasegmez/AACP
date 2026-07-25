import React from 'react';
import { Image, View } from 'react-native';
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
      locations={[0, 0.95]}
      style={{
        paddingTop: insets.top + theme.spacing(2),
        paddingBottom: theme.spacing(5),
        alignItems: 'center',
      }}>
      <View accessibilityRole="header" accessibilityLabel="AA Podcast">
        <Image
          source={AA_LOGO}
          resizeMode="contain"
          style={{ width: 240, height: 132 }}
        />
      </View>
    </LinearGradient>
  );
};
