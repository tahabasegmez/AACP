/**
 * HttpClient — genel HTTP GET sözleşmesi (teknik port).
 *
 * Domain anlamı taşımaz; bu yüzden core'da durur. `data` bu arayüze göre
 * yazılır, `infrastructure/network` somut implementasyonu (fetch/axios) sağlar.
 * app katmanı ikisini birbirine bağlar.
 */
export interface HttpClient {
  /** Verilen URL'den metin (ör. RSS/XML) döner. */
  getText(url: string): Promise<string>;
}
