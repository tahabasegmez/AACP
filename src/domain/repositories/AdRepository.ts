import { Result } from '@core/error';
import { AdBreak, AdPlacement, AdTrackingEvent } from '../entities';

/** Reklam isteği bağlamı — hedefleme ve raporlama için. */
export interface AdRequest {
  readonly placement: AdPlacement;
  /** Reklamın çalınacağı bölüm — hedefleme parametresi olarak iletilir. */
  readonly episodeId: string;
  readonly showId: string;
  /** Bölümün süresi (saniye) — reklam sunucusu buna göre karar verebilir. */
  readonly episodeDurationSec?: number;
}

/**
 * AdRepository — reklam sağlama PORTU.
 *
 * Implementasyon `data` katmanındadır (bugün VAST). Domain, reklamın hangi
 * standarttan/sunucudan geldiğini bilmez; sağlayıcı değiştirmek yalnızca yeni
 * bir implementasyon + composition root'ta bir satır demektir.
 *
 * Reklam ALINAMAZSA bu bir hata değildir: `null` döner ve oynatma reklamsız
 * devam eder. Reklam altyapısı asla dinleme deneyimini bloke etmemelidir.
 */
export interface AdRepository {
  /** Verilen yerleşim için reklam kesintisi getirir; yoksa null. */
  getAdBreak(request: AdRequest): Promise<Result<AdBreak | null>>;

  /**
   * Bir izleme olayını reklam sunucusuna bildirir (VAST tracking pixel).
   * Best-effort: başarısızlık oynatmayı etkilemez.
   */
  trackEvent(adId: string, event: AdTrackingEvent, urls: readonly string[]): Promise<void>;
}
