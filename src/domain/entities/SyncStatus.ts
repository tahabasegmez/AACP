/**
 * Senkron durumu — kullanıcıya "verilerim güvende mi?" sorusunun cevabını
 * verebilmek için tutulur.
 *
 * Domain'de yaşar çünkü hem data katmanı (motor onu üretir) hem presentation
 * (ekran onu gösterir) aynı şekle ihtiyaç duyar; ikisinden birine koymak
 * katmanlar arası ters bağımlılık yaratırdı.
 */
export type SyncPhase = 'idle' | 'syncing' | 'success' | 'error';

export interface SyncStatus {
  readonly phase: SyncPhase;
  /** Son BAŞARILI senkron zamanı (epoch ms); hiç olmadıysa 0. */
  readonly lastSyncAt: number;
  /** Sunucuya gönderilmeyi bekleyen yerel değişiklik sayısı. */
  readonly pendingCount: number;
  /** Son denemede oluşan hata mesajı (kullanıcıya gösterilebilir). */
  readonly error?: string;
  /**
   * Son turda uzak veriyle çakışıp KAYBEDEN yerel değişiklik sayısı.
   *
   * "Son yazan kazanır" politikasında bazı yerel değişiklikler daha yeni bir
   * uzak kayıt tarafından geçersiz kılınır. Bu sessizce olursa kullanıcı
   * "değişikliğim neden kayboldu?" der; sayıyı göstermek bunu açıklar.
   */
  readonly conflictCount: number;
}

export const INITIAL_SYNC_STATUS: SyncStatus = {
  phase: 'idle',
  lastSyncAt: 0,
  pendingCount: 0,
  conflictCount: 0,
};

/** Durum değişikliklerini dinleyenlere yayınlar. */
export type SyncStatusListener = (status: SyncStatus) => void;
