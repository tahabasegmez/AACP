import React from 'react';
import { Image, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO, headerMetrics } from '../../../ui';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
/** Başlık satırına sığacak logo yüksekliği. */
const LOGO_HEIGHT = 30;

/**
 * HomeHeader — ana sayfanın SABİT başlığı (kaydırılınca kaybolmaz).
 *
 * Zemin, marka mavisinden koyu laciverte YUMUŞAK bir degradeyle iner ve alt
 * kenarda tema zeminine kavuşur; tek renk kullanıldığında oluşan sert kesim
 * böylece kaybolur. Degrade dikey yönde açıkça tanımlanır ve kenardan kenara
 * dolar (üst güvenli alan içeri alındığı için Dynamic Island arkasına uzanır).
 *
 * Dikey ölçüler `headerMetrics`ten türetilir — Ara/Kütüphane başlıklarıyla aynı
 * ritim korunur, yalnızca biraz daha derli toplu durur.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={[theme.colors.brand, theme.colors.brandDeep, theme.colors.bg]}
      // Marka mavisi üstte kalır, ortada koyulaşır, son çeyrekte zemine erir.
      locations={[0, 0.62, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={{
        paddingTop: insets.top + theme.spacing(0.5),
        paddingBottom: theme.spacing(1.5),
        paddingHorizontal: headerMetrics.paddingHorizontal,
      }}>
      <View style={{ minHeight: 36, justifyContent: 'center', alignItems: 'flex-start' }}>
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
