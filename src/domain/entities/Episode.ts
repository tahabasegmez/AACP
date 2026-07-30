/**
 * Episode — bir şovun tek bir bölümü (RSS item / enclosure).
 */
export interface Episode {
  /** Kararlı benzersiz kimlik (RSS guid). */
  readonly id: string;
  /** Ait olduğu şovun id'si. */
  readonly showId: string;
  /**
   * Ait olduğu şovun adı.
   *
   * Bölümle birlikte taşınır çünkü kilit ekranı / CarPlay oynatma kartı bölümü
   * TEK BAŞINA alır: orada "hangi podcast" bilgisini gösterebilmek için katalog
   * araması yapmak gerekmemeli.
   */
  readonly showTitle?: string;
  readonly title: string;
  readonly description: string;
  /** Çalınabilir ses dosyası URL'i (enclosure). */
  readonly audioUrl: string;
  /** Ses MIME tipi, ör. "audio/mpeg". */
  readonly mimeType?: string;
  /** Süre (saniye). */
  readonly durationSec: number;
  /** Yayın tarihi (ISO 8601 string). */
  readonly publishedAt: string;
  /** Bölüme özel görsel; yoksa şov görseli kullanılır. */
  readonly imageUrl?: string;
  readonly episodeNumber?: number;
  readonly season?: number;
  /** Dosya boyutu (byte), enclosure length. Offline indirme için faydalı. */
  readonly fileSizeBytes?: number;
}
