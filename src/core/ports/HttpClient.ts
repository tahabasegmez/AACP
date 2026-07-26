/**
 * HttpClient — genel HTTP sözleşmesi (teknik port).
 *
 * Domain anlamı taşımaz; bu yüzden core'da durur. `data` bu arayüze göre
 * yazılır, `infrastructure/network` somut implementasyonu (fetch) sağlar.
 * app katmanı ikisini birbirine bağlar.
 */

/** İstek başlıkları (ör. Authorization). */
export type HttpHeaders = Readonly<Record<string, string>>;

export interface HttpRequestOptions {
  readonly headers?: HttpHeaders;
  /** Bu istek için zaman aşımı (ms); verilmezse istemci varsayılanı. */
  readonly timeoutMs?: number;
}

export interface HttpClient {
  /** Verilen URL'den metin (ör. RSS/XML) döner. */
  getText(url: string, options?: HttpRequestOptions): Promise<string>;

  /**
   * JSON gövdeli POST yapar ve yanıtı JSON olarak çözer.
   * Yanıt gövdesi boşsa `undefined` döner (204 gibi).
   */
  postJson<TResponse, TBody = unknown>(
    url: string,
    body: TBody,
    options?: HttpRequestOptions,
  ): Promise<TResponse | undefined>;
}
