import { Result } from '@core/error';
import { CursorPage, Episode, EpisodeSortOrder, Show } from '../entities';

/** Bir şovun bölüm sayfası isteği. */
export interface EpisodePageQuery {
  /** Şovun kararlı kimliği (sunucu bu kimlikle sorgular). */
  readonly showId: string;
  /** Şovun RSS adresi (yerel kaynak bununla çalışır). */
  readonly feedUrl: string;
  readonly limit: number;
  /** Önceki sayfanın `nextCursor` değeri; ilk sayfada boştur. */
  readonly cursor?: string;
  readonly search?: string;
  readonly sort: EpisodeSortOrder;
}

export interface EpisodePageResult {
  readonly page: CursorPage<Episode>;
  /**
   * Kaynak şov meta verisini de biliyorsa döner.
   *
   * RSS kaynağı feed'in başlığını zaten okur; sunucu kaynağı yalnızca
   * bölümleri döner ve meta veri katalogdan gelir. Bu alan opsiyoneldir ki
   * çağıran taraf hangi kaynağın konuştuğunu bilmek zorunda kalmasın.
   */
  readonly show?: Show;
}

/**
 * EpisodePageRepository — bölüm sayfalarının PORTU.
 *
 * Bölümlerin NEREDEN geldiğini gizler: sunucudaki `episodes` tablosundan da
 * gelebilir, cihazda çözülen RSS'ten de. Uygulama büyüdükçe varsayılan kaynak
 * sunucudur — her şov açılışında 4 MB'lık bir feed indirmek ne yayıncının
 * bant genişliğine ne kullanıcının veri paketine sığar.
 *
 * RSS yolu yedek olarak KORUNUR: sunucu kapalıyken ya da erişilemezken
 * uygulama çalışmaya devam etmelidir.
 */
export interface EpisodePageRepository {
  getPage(query: EpisodePageQuery): Promise<Result<EpisodePageResult>>;
}
