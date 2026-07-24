/**
 * Offline indirme modeli.
 *
 * Bir bölümün çevrimdışı dinlenmesi için indirme durumunu ve yerel dosya yolunu
 * temsil eder. Gösterim/oynatma meta'sı (başlık, showId, kapak, süre) ile
 * "İndirilenler" listesi feed çekmeden kart gösterebilir ve doğrudan oynatabilir.
 */
export type DownloadStatus = 'downloading' | 'downloaded' | 'failed';

export interface DownloadItem {
  readonly episodeId: string;
  readonly status: DownloadStatus;
  /** İndirildiğinde yerel dosya yolu (mutlak). */
  readonly localPath?: string;

  // Gösterim/oynatma meta'sı:
  readonly episodeTitle?: string;
  readonly showId?: string;
  readonly artworkUrl?: string;
  readonly durationSec?: number;
  readonly publishedAt?: string;
}
