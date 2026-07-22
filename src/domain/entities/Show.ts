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

/**
 * İki Show'u birleştirir: `primary` (ör. RSS feed'inden gelen güncel/zengin veri)
 * öncelikli, eksik/boş alanlar `fallback`'ten (ör. curated katalog) tamamlanır.
 *
 * Kullanım: şov detayında feed geldiğinde katalog ipuçlarıyla güvenli birleşim.
 */
export const mergeShow = (primary: Show, fallback?: Show): Show => {
  if (!fallback) {
    return primary;
  }
  const pick = (a?: string, b?: string) => (a && a.trim() ? a : b);
  return {
    id: primary.id || fallback.id,
    title: pick(primary.title, fallback.title) ?? primary.title,
    description: pick(primary.description, fallback.description) ?? '',
    author: pick(primary.author, fallback.author) ?? '',
    imageUrl: primary.imageUrl ?? fallback.imageUrl,
    feedUrl: primary.feedUrl || fallback.feedUrl,
    language: primary.language ?? fallback.language,
    categories:
      primary.categories.length > 0 ? primary.categories : fallback.categories,
    websiteUrl: primary.websiteUrl ?? fallback.websiteUrl,
  };
};
