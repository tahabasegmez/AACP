import { PodcastFeed } from '@domain/entities';

/**
 * FeedSource — bir şovun feed'ini (şov meta verisi + bölümler) çözen kaynak.
 *
 * STRATEJİ PORTU: bugün RSS'ten okuyoruz (RssFeedSource); yarın Transistor
 * API'sine geçmek istediğimizde yalnızca DI'da farklı bir implementasyon
 * bağlanır (TransistorFeedSource) — repository, use case ve UI değişmez.
 *
 * Bu yüzden dönüş tipi ham DTO değil, domain nesnesidir: kaynağa özgü şekil
 * bu sınırın altında kalır.
 */
export interface FeedSource {
  /**
   * Şovun feed'ini çözer.
   * @param feedUrl Şovun RSS adresi. Transistor gibi API tabanlı kaynaklarda
   *   bu değer şovu tanımlamak için (slug/id eşlemesi) kullanılır.
   */
  fetchFeed(feedUrl: string): Promise<PodcastFeed>;
}
