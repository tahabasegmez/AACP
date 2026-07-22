/**
 * Offline indirme modeli — İLERİDE implemente edilecek (mimaride yeri hazır).
 *
 * Bölümlerin çevrimdışı dinlenmesi için indirme durumunu domain seviyesinde
 * temsil eder. İlk sürümde yalnızca tip olarak var; `DownloadRepository`
 * implementasyonu sonraki fazda gelecek.
 */
export type DownloadStatus =
  | 'not_downloaded'
  | 'queued'
  | 'downloading'
  | 'downloaded'
  | 'failed';

export interface DownloadItem {
  readonly episodeId: string;
  readonly status: DownloadStatus;
  /** 0..1 arası ilerleme. */
  readonly progress: number;
  /** İndirildiğinde yerel dosya yolu. */
  readonly localPath?: string;
}
