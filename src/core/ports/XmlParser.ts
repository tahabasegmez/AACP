/**
 * XmlParser — XML metnini nesneye çeviren genel sözleşme (teknik port).
 *
 * `data` bu arayüze göre yazılır; `infrastructure/rss` somut implementasyonu
 * (fast-xml-parser) sağlar.
 */
export interface XmlParser {
  /** XML string'ini gevşek tipli bir nesneye çevirir. */
  parse<T = unknown>(xml: string): T;
}
