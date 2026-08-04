/**
 * React Native CLI yapılandırması.
 *
 * `expo` paketi EAS Build için kuruludur (bkz. eas.json); uygulama HİÇBİR
 * Expo modülü kullanmaz — babel yapılandırması `@react-native/babel-preset`
 * kullanır, kaynak ağacında tek bir `expo-*` içe aktarımı yoktur ve iOS
 * Podfile'ı `use_expo_modules!` çağırmaz.
 *
 * Buna rağmen otolinkleme, paketin içindeki `android/` klasörünü görüp onu
 * Gradle projesine dahil etmeye çalışıyor ve derleme "Plugin with id
 * 'expo-module-gradle-plugin' not found" ile düşüyordu. Expo modül sistemini
 * kurmak, kullanılmayan bir altyapıyı üç platform yapılandırmasına birden
 * eklemek olurdu.
 *
 * Bu yüzden paket yalnızca NATIVE bağlamada devre dışı bırakılır; EAS tarafı
 * (eas.json, app.json) etkilenmez. İleride bir Expo modülü gerçekten
 * gerekirse bu blok kaldırılır ve modül sistemi usulünce kurulur.
 */
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
