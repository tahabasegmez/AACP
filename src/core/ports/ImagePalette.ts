/**
 * ImagePalette — bir görselden baskın rengi çıkarma sözleşmesi (teknik port).
 *
 * Domain anlamı taşımaz; core'da durur. Kapak görsellerine göre arka plan
 * renklendirmek için kullanılır. Somut implementasyon `infrastructure`'da
 * (native-dep'siz hash tabanlı; ileride istenirse gerçek piksel-renk çıkarımına
 * geçilebilir). Değiştirmek gerekirse tek dosya değişir; null dönerse çağıran
 * taraf marka rengine düşer.
 */
export interface ImagePalette {
  getDominant(uri: string): Promise<string | null>;
}
