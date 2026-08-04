import React from 'react';
import { Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../theme';
import { AA_LOGO, ScreenHeader } from '../../../ui';
import { AccountButton } from '../../account/AccountButton';

/** Logonun gerçek en/boy oranı (kaynak görsel 342×288). */
const LOGO_ASPECT = 342 / 288;
/**
 * Logo yüksekliği.
 *
 * Diğer sekmelerdeki başlık metniyle aynı optik ağırlıkta durması için
 * ölçülüdür; büyütmek logoyu satırın tek hâkimi yapar ve sağdaki hesap
 * düğmesiyle dengesi bozulur.
 */
const LOGO_HEIGHT = 30;

/**
 * HomeHeader — ana sayfanın SABİT başlığı (kaydırılınca kaybolmaz).
 *
 * Ara/Kütüphane ile AYNI `ScreenHeader` bileşenini kullanır; tek farkı sol
 * tarafta başlık metni yerine marka logosu olması. Böylece sekmeler arasında
 * geçerken başlığın alt hizası, kenar boşlukları ve sağdaki eylemin yeri
 * birebir aynı kalır — geometri iki yerde ayrı ayrı tanımlanmaz.
 *
 * Zemin, ALTINDAKİ İÇERİKLE aynı renktir: başlık ayrı bir şerit olarak durmaz,
 * ekranın devamı gibi okunur. Üst güvenli alan başlığın içine alınır, böylece
 * aynı renk Dynamic Island / durum çubuğu arkasına kadar kenardan kenara
 * doldurur ve tepede açık bir bant kalmaz.
 */
export const HomeHeader: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{ backgroundColor: theme.colors.bg, paddingTop: insets.top }}>
      <ScreenHeader
        left={
          <Image
            source={AA_LOGO}
            resizeMode="contain"
            accessibilityRole="header"
            accessibilityLabel="AA Podcast"
            style={{ height: LOGO_HEIGHT, width: LOGO_HEIGHT * LOGO_ASPECT }}
          />
        }
        right={<AccountButton />}
      />
    </View>
  );
};
