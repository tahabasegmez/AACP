/**
 * app — composition root. Tüm katmanları birbirine bağlayan tek yer.
 */
export * from './AppRoot';
export * from './di';
// registerCarPlay bilinçli olarak buradan EXPORT EDİLMEZ: bu barrel App.tsx'ten
// yüklenir ve react-native-carplay (iOS-only) Android'de gereksiz yüklenmesin.
// index.js onu yalnızca iOS'ta doğrudan require eder.
