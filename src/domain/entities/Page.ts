/**
 * CursorPage<T> — İMLEÇLE sayfalanmış liste sonucu.
 *
 * `Page`den farkı, sonraki sayfanın "kaçıncı öğeden" değil "nerede kalındığı"
 * ile istenmesidir. İki sebeple:
 *
 *  - **Maliyet:** sunucuda `offset 10000`, veritabanına her seferinde ilk
 *    10.000 satırı saydırır; imleç indekste doğrudan yerini bulur.
 *  - **Doğruluk:** araya yeni bölüm girdiğinde offset tüm sayfa sınırlarını
 *    kaydırır ve kullanıcı aynı bölümü iki kez görür; imleçte bu olmaz.
 *
 * İmleç OPAK bir metindir: içeriğini yalnızca onu üreten kaynak bilir. Sunucu
 * kaynağı için sıralama anahtarı, yerel RSS kaynağı için sıradaki konumdur —
 * çağıran taraf ikisini de aynı şekilde kullanır.
 */
export interface CursorPage<T> {
  readonly items: readonly T[];
  /** Sonraki sayfanın imleci; yoksa liste bitmiştir. */
  readonly nextCursor?: string;
}

/**
 * Page<T> — sayfalanmış liste sonucu.
 *
 * Büyük feed'lerde (ör. 1900+ bölüm) tüm listeyi UI'a vermek yerine parçalar
 * halinde vermeyi sağlar. `hasMore` sonsuz kaydırma (infinite scroll) için.
 */
export interface Page<T> {
  readonly items: readonly T[];
  /** Filtre uygulandıktan sonraki toplam öğe sayısı. */
  readonly total: number;
  readonly offset: number;
  readonly limit: number;
  readonly hasMore: boolean;
}

/**
 * Bir diziyi verilen limit/offset ile sayfalar (saf fonksiyon).
 * Negatif/taşan değerler güvenle kırpılır.
 */
export const paginate = <T>(
  items: readonly T[],
  limit: number,
  offset: number,
): Page<T> => {
  const safeOffset = Math.max(0, Math.floor(offset));
  const safeLimit = Math.max(0, Math.floor(limit));
  const slice = items.slice(safeOffset, safeOffset + safeLimit);
  return {
    items: slice,
    total: items.length,
    offset: safeOffset,
    limit: safeLimit,
    hasMore: safeOffset + slice.length < items.length,
  };
};
