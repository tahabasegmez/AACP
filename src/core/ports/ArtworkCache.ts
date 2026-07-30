/**
 * ArtworkCache — uzak kapak görsellerini yerel dosyaya alan teknik port.
 *
 * NEDEN: bazı native yüzeyler (CarPlay şablonları) görseli ANA İŞ PARÇACIĞINDA
 * çözer. Uzak adres verilirse ya çizilmez ya da her satır için ağ beklenir.
 * Görseli önceden indirip yerel dosya adresi vermek ikisini de çözer.
 *
 * Domain anlamı taşımaz; core'da durur. Somut implementasyon
 * `infrastructure/download` altındadır.
 */
export interface ArtworkCache {
  /**
   * Uzak görselin yerel dosya adresini döner; gerekiyorsa indirir.
   *
   * Başarısızlık HATA DEĞİLDİR: `undefined` döner ve çağıran görseli atlar —
   * kapak yüklenemedi diye liste kaybolmamalı.
   */
  localUri(remoteUrl: string): Promise<string | undefined>;
}
