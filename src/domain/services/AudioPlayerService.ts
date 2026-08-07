import { Episode, PlaybackState } from '../entities';

/**
 * Bir kuyruk öğesinin NEREDEN geldiği.
 *
 *  - `context`: bir şova/listeye girip çalmaya başlayınca kendiliğinden gelen
 *    bölümler,
 *  - `user`: kullanıcının açıkça "sıraya ekle" dediği bölümler.
 *
 * Ayrım davranışsaldır, süsleme değil: kullanıcının eklediği bölüm bağlamın
 * ÖNÜNE geçer. "Şu bölümü de dinleyeyim" demek, o bölümü şovun geri kalanının
 * arkasına atmak anlamına gelmemeli.
 */
export type QueueSource = 'context' | 'user';

export interface QueueItem {
  readonly episode: Episode;
  readonly source: QueueSource;
}

/** Kuyruğun anlık görüntüsü: öğeler ve çalan konum (`-1` = kuyruk boş). */
export interface QueueSnapshot {
  readonly items: readonly QueueItem[];
  readonly index: number;
}

/**
 * AudioPlayerService — ses oynatma ve KUYRUK portu (domain servis arayüzü).
 *
 * Somut implementasyon `infrastructure/audio` içinde react-native-track-player
 * ile yazılır. presentation ve carplay bu arayüzü kullanır; böylece hem mobil
 * UI hem CarPlay aynı oynatma mantığını paylaşır, kütüphaneyi tanımaz.
 *
 * KUYRUK BURADA YAŞAR — bilinçli olarak. Uygulama bir dönem kendi kuyruğunu
 * tutuyor, oynatıcıya ise tek parça yüklüyordu; "sonraki bölüm" komutlarını da
 * el yapımı bir köprü karşılıyordu. İki ayrı gerçek kaynak kaçınılmaz olarak
 * ayrışıyordu: kilit ekranındaki ve Dynamic Island'daki tuşlar uygulamadaki
 * sırayı takip etmiyordu. Artık sıra tek yerde — oynatıcıda — durur; kilit
 * ekranı, Dynamic Island, CarPlay ve direksiyon tuşları aynı kuyruğa bakar.
 */
export interface AudioPlayerService {
  /** Player'ı bir kez hazırlar (uygulama açılışında). */
  setup(): Promise<void>;

  // --- kuyruk -------------------------------------------------------------

  /**
   * Yeni oynatma bağlamı kurar ve `index`teki bölümden çalmaya başlar.
   *
   * Tüm bölümler `context` kaynaklı olur: bir şova ya da listeye girip çalmak
   * demek, ardındaki bölümlerin de sıraya girmesi demektir.
   */
  setQueue(
    episodes: readonly Episode[],
    index: number,
    startPositionSec?: number,
  ): Promise<void>;

  /**
   * Kullanıcı eklemesi — çalan bölümün ARDINDAKİ kullanıcı bloğunun sonuna
   * girer, bağlam bölümlerinin önüne geçer.
   */
  enqueue(episode: Episode): Promise<void>;

  /** Kuyruktan bir öğeyi konumuna göre çıkarır. */
  removeAt(index: number): Promise<void>;

  /** Bir öğeyi kuyrukta başka bir konuma taşır. */
  moveItem(from: number, to: number): Promise<void>;

  /** Kuyrukta belirtilen konuma atlar (isteğe bağlı başlangıç saniyesiyle). */
  skipTo(index: number, startPositionSec?: number): Promise<void>;

  /** Sıradaki bölüm. Kuyruğun sonundaysa hiçbir şey yapmaz. */
  skipToNext(): Promise<void>;

  /** Önceki bölüm. Kuyruğun başındaysa hiçbir şey yapmaz. */
  skipToPrevious(): Promise<void>;

  /** O anki kuyruk ve çalan konum. */
  getQueue(): Promise<QueueSnapshot>;

  // --- taşıma -------------------------------------------------------------

  resume(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;

  /** Belirtilen saniyeye atlar. */
  seekTo(positionSec: number): Promise<void>;

  /** Oynatma hızını ayarlar (ör. 1.0, 1.5). */
  setRate(rate: number): Promise<void>;

  /** Anlık durumu döner. */
  getState(): Promise<PlaybackState>;

  /** Durum değişikliklerine abone olur; aboneliği iptal eden fonksiyon döner. */
  subscribe(listener: (state: PlaybackState) => void): () => void;
}
