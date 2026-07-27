/**
 * Offline indirme modeli.
 *
 * Bir bölümün çevrimdışı dinlenmesi için indirme durumunu ve yerel dosyasını
 * temsil eder. Gösterim/oynatma meta'sı (başlık, showId, kapak, süre) ile
 * "İndirilenler" listesi feed çekmeden kart gösterebilir ve doğrudan oynatabilir.
 */
export type DownloadStatus = 'downloading' | 'downloaded' | 'failed';

export interface DownloadItem {
  readonly episodeId: string;
  readonly status: DownloadStatus;

  /**
   * Dosyanın indirme klasörü içindeki ADI (yol değil).
   *
   * MUTLAK yol saklanmaz: iOS'ta uygulamanın Documents dizini bir container
   * UUID'si içerir ve bu UUID yeniden kurulumda/build'de DEĞİŞİR. Mutlak yol
   * saklanırsa kayıtlar bir sonraki kurulumda geçersiz dosyayı işaret eder ve
   * oynatma "unsupported URL" hatasıyla düşer. Bu yüzden yalnızca dosya adı
   * saklanır; tam yol her okumada güncel dizinle birleştirilerek üretilir.
   */
  readonly fileName?: string;

  /**
   * Çalınmaya hazır tam yol. Depolanmaz — repository okurken hesaplar.
   * (Bu yüzden eski/taşınmış kayıtlar kendiliğinden doğru yola çözülür.)
   */
  readonly localPath?: string;

  /**
   * Bölümün UZAK ses adresi. İndirme silinse bile bölümün çalınabilmesi ve
   * yeniden indirilebilmesi için saklanır — aksi halde "İndirilenler"den gelen
   * bir bölüm silindikten sonra kaynaksız kalırdı.
   */
  readonly audioUrl?: string;

  // Gösterim/oynatma meta'sı:
  readonly episodeTitle?: string;
  readonly showId?: string;
  readonly artworkUrl?: string;
  readonly durationSec?: number;
  readonly publishedAt?: string;
}

/**
 * Bölüm çevrimdışı çalınmaya hazır mı?
 * Yalnızca "indirildi" işaretli VE dosyası yerinde olan kayıtlar hazırdır.
 */
export const isPlayableOffline = (item: DownloadItem | null | undefined): boolean =>
  !!item && item.status === 'downloaded' && !!item.localPath;
