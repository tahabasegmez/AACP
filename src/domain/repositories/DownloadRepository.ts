import { Result } from '@core/error';
import { DownloadItem, Episode } from '../entities';

/**
 * DownloadRepository — bölüm indirmelerini yönetir (dosya + meta veri).
 *
 * PORT. Implementasyon `data` katmanında; indirme motoru (Downloader) ve kalıcı
 * meta (KeyValueStorage) `infrastructure`'dan enjekte edilir. Domain nerede/nasıl
 * saklandığını bilmez — ileride motor/depolama değişse arayüz sabit kalır.
 */
export interface DownloadRepository {
  /** Tek bölümün indirme kaydı (yoksa null). */
  get(episodeId: string): Promise<Result<DownloadItem | null>>;
  /** Tüm indirmeler ("İndirilenler" listesi). */
  list(): Promise<Result<readonly DownloadItem[]>>;
  /** Bölümü indirir; tamamlanınca "downloaded" kaydı döner. */
  download(episode: Episode): Promise<Result<DownloadItem>>;
  /** İndirmeyi ve dosyayı siler. */
  remove(episodeId: string): Promise<Result<void>>;
}
