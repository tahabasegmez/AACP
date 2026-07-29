/**
 * `react-native/Libraries/Image/resolveAssetSource` için CommonJS sarmalayıcı.
 *
 * React Native 0.86'da bu modül `export default` kullanıyor; `require()` ile
 * alındığında bir FONKSİYON değil `{ default: fn }` nesnesi döner. Modülü
 * doğrudan çağıran kütüphaneler (ör. react-native-carplay 2.3.0) bu yüzden
 * "object is not a function" hatasıyla çöker.
 *
 * Burada RN'in genel API'si (`Image.resolveAssetSource`) kullanılır; böylece
 * iç modül yoluna bağımlılık kalmaz. `require` fonksiyon içinde yapılır:
 * modül yüklenme sırası (döngüsel içe aktarım) ne olursa olsun çalışsın.
 *
 * Yönlendirme `metro.config.js` içindedir.
 */
module.exports = function resolveAssetSource(source) {
  return require('react-native').Image.resolveAssetSource(source);
};
