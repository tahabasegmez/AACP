/**
 * react-native-image-colors jest mock'u — testler native modül olmadan çalışsın.
 */
const getColors = async () => ({
  platform: 'ios',
  background: '#123456',
  primary: '#123456',
  detail: '#123456',
  secondary: '#123456',
});

module.exports = { __esModule: true, getColors };
