/**
 * Show — bir podcast şovu (Transistor'daki bir "show").
 *
 * Saf iş nesnesi: RSS/JSON/DTO ayrıntısı içermez. RSS channel verisinden
 * `data/mappers` tarafından üretilir.
 */
export interface Show {
  /** Kararlı benzersiz kimlik (Transistor slug'ı). */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly author: string;
  /** Kapak görseli URL'i (varsa). */
  readonly imageUrl?: string;
  /** Şovun RSS feed URL'i — bölümleri çekmek için kullanılır. */
  readonly feedUrl: string;
  /** ISO dil kodu, ör. "tr". */
  readonly language?: string;
  readonly categories: readonly string[];
  /** Şov ana sayfası (web) linki, varsa. */
  readonly websiteUrl?: string;
}
