/**
 * ImagePalette — bir görselden baskın rengi çıkarma sözleşmesi (teknik port).
 *
 * Domain anlamı taşımaz; core'da durur. Kapak görsellerine göre arka plan
 * renklendirmek için kullanılır. Somut implementasyon `infrastructure`'da
 * (react-native-image-colors). Değiştirmek gerekirse tek dosya değişir; başarısız
 * olursa null döner (çağıran taraf marka rengine düşer).
 */
export interface ImagePalette {
  getDominant(uri: string): Promise<string | null>;
}
