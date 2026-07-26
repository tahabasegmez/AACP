/**
 * Reklam modeli — VAST'tan bağımsız, saf domain temsili.
 *
 * VAST bugünkü kaynak standardımız ama domain onu bilmez: farklı bir reklam
 * sağlayıcısına geçilse de (ör. kendi kampanya sunucumuz) bu şekil aynı kalır.
 */

/** Reklamın oynatma akışındaki yeri. */
export type AdPlacement = 'preroll' | 'midroll' | 'postroll';

/**
 * VAST izleme (tracking) olayları — reklam verene raporlanır.
 * Her olay için bir veya daha fazla URL çağrılır (piksel isteği).
 */
export type AdTrackingEvent =
  | 'impression'
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'skip'
  | 'click'
  | 'error';

export interface Ad {
  /** Reklam kimliği (VAST `<Ad id>`), raporlama ve tekrar önleme için. */
  readonly id: string;
  /** Çalınacak ses dosyası. */
  readonly mediaUrl: string;
  /** Süre (saniye); VAST bildirir, gerçek süre farklı olabilir. */
  readonly durationSec: number;
  /** Player'da gösterilecek başlık (VAST `AdTitle`). */
  readonly title?: string;
  /** Reklam veren adı — "Reklam · <marka>" göstergesi için. */
  readonly advertiser?: string;
  /** Tıklanınca açılacak adres (companion/clickthrough). */
  readonly clickUrl?: string;
  /** Olay → çağrılacak izleme URL'leri. */
  readonly tracking: Readonly<Partial<Record<AdTrackingEvent, readonly string[]>>>;
}

/**
 * AdBreak — tek bir kesintide çalınacak reklam(lar).
 * VAST bir "ad pod" (arka arkaya birden çok reklam) döndürebilir.
 */
export interface AdBreak {
  readonly placement: AdPlacement;
  readonly ads: readonly Ad[];
}

/** Kesintideki toplam süre — UI'da "reklam bitene kadar" göstergesi için. */
export const adBreakDurationSec = (adBreak: AdBreak): number =>
  adBreak.ads.reduce((total, ad) => total + ad.durationSec, 0);

/** Reklamsız (boş) kesinti mi? */
export const isEmptyAdBreak = (adBreak: AdBreak | null): boolean =>
  !adBreak || adBreak.ads.length === 0;
