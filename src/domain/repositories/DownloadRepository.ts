import { Result } from '@core/error';
import { DownloadItem, Episode } from '../entities';

/**
 * DownloadRepository — offline indirme yönetimi. İLERİDE implemente edilecek.
 *
 * PORT (arayüz). İlk sürümde yalnızca sözleşme olarak var; `data` katmanındaki
 * implementasyonu (react-native-blob-util tabanlı) sonraki fazda gelecek.
 * Şimdilik burada tanımlı olması, UI ve use case'lerin arayüze göre
 * yazılabilmesini sağlar.
 */
export interface DownloadRepository {
  getDownload(episodeId: string): Promise<Result<DownloadItem>>;
  listDownloads(): Promise<Result<readonly DownloadItem[]>>;
  enqueue(episode: Episode): Promise<Result<DownloadItem>>;
  remove(episodeId: string): Promise<Result<void>>;
}
