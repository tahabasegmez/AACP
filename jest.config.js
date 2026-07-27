module.exports = {
  preset: '@react-native/jest-preset',
  // worker/ ayrı bir Cloudflare Workers projesidir; kendi test koşucusuyla
  // çalışır (`cd worker && npm run ci`). Buradan hariç tutulur ki testler
  // çift koşmasın.
  testPathIgnorePatterns: ['/node_modules/', '/worker/'],
  // React Navigation ve react-native-* paketleri ESM olarak yayınlanıyor;
  // jest'in bunları da Babel'den geçirmesi için node_modules istisnasına ekle.
  transformIgnorePatterns: [
    'node_modules/(?!(?:jest-)?@?react-native|@react-native-community|@react-navigation|react-native-.*)/',
  ],
};
