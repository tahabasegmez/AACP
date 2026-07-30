import { Episode } from '../entities';

/** Kuyruğun anlık görüntüsü: bölümler ve çalan konum. */
export interface QueueSnapshot {
  readonly episodes: readonly Episode[];
  readonly index: number;
}

/**
 * PlaybackSessionService — "o an ne çalıyor ve sırada ne var" portu.
 *
 * Oynatma oturumu TEK yerde yaşar: kuyruk ve çalan bölüm birlikte kurulur.
 * İkisini ayrı ayrı ayarlamak mümkün olduğunda biri unutulabiliyor — CarPlay
 * yalnızca kuyruğu kurmuş, telefondaki kapak/başlık eski bölümde kalmıştı.
 *
 * Bu yüzden `setContext` ikisini birden alır. Sonuç: direksiyon tuşları, kilit
 * ekranı, telefondaki oynatıcı ve CarPlay aynı gerçeği görür.
 *
 * Port domain'de durur ki CarPlay presentation'ı tanımasın; somut uygulama
 * composition root'ta bağlanır.
 */
export interface PlaybackSessionService {
  /**
   * Yeni oynatma bağlamı kurar: kuyruk ve içindeki çalan bölümün konumu.
   * Oynatmayı BAŞLATMAZ — yalnızca "ne çalıyor" gerçeğini günceller.
   */
  setContext(episodes: readonly Episode[], index: number): void;
  /** O anki kuyruk — "Sıradakiler" listesi bunu gösterir. */
  getQueue(): QueueSnapshot;
}
