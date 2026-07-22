module.exports = {
  preset: '@react-native/jest-preset',
  // React Navigation ve react-native-* paketleri ESM olarak yayınlanıyor;
  // jest'in bunları da Babel'den geçirmesi için node_modules istisnasına ekle.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?@?react-native|@react-native-community|@react-navigation|react-native-.*)/',
  ],
};
