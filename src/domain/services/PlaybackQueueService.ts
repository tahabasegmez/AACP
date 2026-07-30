import { Episode } from '../entities';

/** Kuyruğun anlık görüntüsü: bölümler ve çalan konum. */
export interface QueueSnapshot {
  readonly episodes: readonly Episode[];
  readonly index: number;
}

/**
 * PlaybackQueueService — "o an çalınan bağlamın kuyruğu" portu.
 *
 * Kuyruk TEK yerde yaşar (uygulamanın oynatıcı durumu). CarPlay bir listeden
 * çalmaya başladığında aynı kuyruğu kurar; böylece direksiyon tuşları, kilit
 * ekranı ve telefondaki "Sıra" ekranı aynı sırayı görür. Kuyruğun kopyasını
 * CarPlay'de tutmak iki gerçeğin ayrışmasına yol açardı.
 *
 * Port domain'de durur ki CarPlay presentation'ı tanımasın; somut uygulama
 * composition root'ta bağlanır.
 */
export interface PlaybackQueueService {
  /** Yeni bağlam kuyruğu kurar (`index` çalan bölümün konumu). */
  setQueue(episodes: readonly Episode[], index: number): void;
  /** O anki kuyruk — "Sıradakiler" listesi bunu gösterir. */
  getQueue(): QueueSnapshot;
}
