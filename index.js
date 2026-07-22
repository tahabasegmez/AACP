/**
 * @format
 */

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
if (Platform.OS === 'ios') {
  require('./src/app/carplay/registerCarPlay').registerCarPlay();
}
