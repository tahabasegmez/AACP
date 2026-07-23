/**
 * @format
 */

// react-native-gesture-handler dokümanı gereği giriş dosyasının EN ÜSTÜNDE olmalı.
import 'react-native-gesture-handler';

import { AppRegistry, Platform } from 'react-native';
import TrackPlayer from 'react-native-track-player';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);

// track-player arka plan servisi: kilit ekranı / CarPlay / Android Auto uzaktan
// kontrollerini işler (bkz. src/infrastructure/audio/playbackService.ts).
TrackPlayer.registerPlaybackService(
  () => require('./src/infrastructure/audio/playbackService').default,
);

// CarPlay yalnızca iOS'ta; modülü yalnızca orada yükle (Android'de import etme).
// CarPlay entitlement'ı henüz yoksa veya native modül hazır değilse uygulamanın
// açılışı engellenmemeli — bu yüzden hata yutuluyor, sadece loglanıyor.
if (Platform.OS === 'ios') {
  try {
    require('./src/app/carplay/registerCarPlay').registerCarPlay();
  } catch (error) {
    console.warn('CarPlay kaydı atlandı:', error);
  }
}
