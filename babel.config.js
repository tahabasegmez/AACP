module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@core': './src/core',
          '@domain': './src/domain',
          '@data': './src/data',
          '@infrastructure': './src/infrastructure',
          '@presentation': './src/presentation',
          '@carplay': './src/carplay',
          '@app': './src/app',
        },
      },
    ],
    // react-native-reanimated v4: worklets plugin EN SONDA olmalı.
    'react-native-worklets/plugin',
  ],
};
