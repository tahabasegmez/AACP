import { Result } from '@core/error';
import { Show } from '../entities';

/**
 * ShowCatalogRepository — mevcut şovların listesini (katalog) sağlar.
 *
 * PORT (arayüz). Implementasyon `data` katmanında. İlk implementasyon curated
 * feed listesinden (core/config/feedCatalog) beslenir; ileride remote-config'e
 * geçilebilir — çağıran kod değişmez.
 */
export interface ShowCatalogRepository {
  /** Tüm şovları döner (temel meta veri; her biri kendi feedUrl'ini taşır). */
  getShows(): Promise<Result<readonly Show[]>>;

  /** Tek bir şovu id (slug) ile getirir. */
  getShowById(id: string): Promise<Result<Show>>;
}
