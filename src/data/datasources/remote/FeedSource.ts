import { PodcastFeed } from '@domain/entities';

/**
 * FeedSource — bir şovun feed'ini (şov meta verisi + bölümler) çözen kaynak.
 *
 * STRATEJİ PORTU: bugün RSS'ten okuyoruz (RssFeedSource). RSS, podcast
 * dünyasının sağlayıcıdan bağımsız ortak arayüzüdür; barındırıcıya özel bir
 * API'ye bağlanmak, barındırıcı değiştiğinde uygulamayı da değiştirmek
 * demekti. Port, kaynağı ileride değiştirmek (ör. bölüm listesini kendi
 * sunucumuzdan sunmak) gerekirse tek bağlama noktası olarak durur —
 * repository, use case ve UI etkilenmez.
 *
 * Bu yüzden dönüş tipi ham DTO değil, domain nesnesidir: kaynağa özgü şekil
 * bu sınırın altında kalır.
 */
export interface FeedSource {
  /** Şovun feed'ini çözer. @param feedUrl Şovun RSS adresi. */
  fetchFeed(feedUrl: string): Promise<PodcastFeed>;
}
