/**
 * ArtworkCache — uzak kapak görsellerini yerel dosyaya alan teknik port.
 *
 * NEDEN: bazı native yüzeyler (CarPlay şablonları) yalnızca YEREL görsel kabul
 * eder; uzak adres verildiğinde görseli çizmez ve ana iş parçacığında hata
 * üretir. Görseli önceden indirip `file://` adresi vermek hem çalışır hem de
 * ana iş parçacığında ağ beklemesi oluşturmaz.
 *
 * Domain anlamı taşımaz; core'da durur. Somut implementasyon
 * `infrastructure/download` altındadır.
 */
export interface ArtworkCache {
  /**
   * Uzak görselin yerel `file://` adresini döner; gerekiyorsa indirir.
   *
   * Başarısızlık HATA DEĞİLDİR: `undefined` döner ve çağıran görseli atlar —
   * kapak yüklenemedi diye liste kaybolmamalı.
   */
  localUri(remoteUrl: string): Promise<string | undefined>;
}
