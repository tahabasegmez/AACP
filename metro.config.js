const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/** Yalnızca bu iç RN yolunu doğrudan `require` eden kütüphaneler etkilenir. */
const RN_RESOLVE_ASSET_SOURCE = 'react-native/Libraries/Image/resolveAssetSource';

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    /**
     * RN 0.86'da `resolveAssetSource` ESM'e geçtiği için `require()` bir nesne
     * döndürüyor; onu fonksiyon sanıp çağıran kütüphaneler çöküyor
     * (react-native-carplay 2.3.0 → "object is not a function").
     *
     * İsteği interop'u düzelten sarmalayıcıya yönlendiriyoruz. RN'in kendi
     * dosyaları bu modüle GÖRELİ yolla eriştiği için etkilenmez.
     */
    resolveRequest: (context, moduleName, platform) => {
      if (moduleName === RN_RESOLVE_ASSET_SOURCE) {
        return {
          type: 'sourceFile',
          filePath: path.resolve(__dirname, 'shims/resolveAssetSource.js'),
        };
      }
      return context.resolveRequest(context, moduleName, platform);
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
