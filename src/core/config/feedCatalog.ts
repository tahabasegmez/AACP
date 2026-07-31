/**
 * Şov kataloğunun taşıdığı meta veri.
 *
 * Katalog artık UYGULAMAYA GÖMÜLÜ DEĞİLDİR: şovlar sunucudaki `shows`
 * tablosunda yaşar ve `/v1/catalog` ucundan gelir (bkz. docs/VERI-MIMARISI.md).
 * Şov eklemek bir veritabanı satırı işlemidir; uygulama güncellemesi gerekmez.
 *
 * Bu tip hem uzak yanıtın çözülmesinde hem de `Show` entity'sine dönüşümde
 * kullanılır — sözleşme tek yerde durur.
 *
 * Liste ekranı için gereken hafif alanlar (başlık, görsel, açıklama) katalogda
 * taşınır; bir şovun bölümleri yalnızca o şova girildiğinde feed'den çekilir.
 * Böylece 11 adet ~4MB feed'i sırf liste için indirmekten kaçınırız.
 */
export interface FeedCatalogEntry {
  /** Kararlı benzersiz kimlik (feed slug'ı). */
  readonly slug: string;
  /** Şovun RSS feed URL'i. */
  readonly feedUrl: string;
  /** Liste ekranında gösterilecek başlık. */
  readonly title: string;
  /** Kapak görseli (liste için). */
  readonly imageUrl?: string;
  /** Kısa açıklama (liste için). */
  readonly description?: string;
}
