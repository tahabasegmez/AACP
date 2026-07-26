import { AdPlacement } from './Ad';

/**
 * Reklam politikası — reklamın NE ZAMAN gösterileceğine karar veren saf kurallar.
 *
 * Ayrı tutulmasının sebebi: politika iş kuralıdır, oynatma tekniği değil. Burada
 * saf fonksiyonlar olarak durur, kolayca test edilir ve ileride değiştirmek
 * (ör. "abonelere reklam gösterme", "günde en fazla 5 reklam") oynatma koduna
 * dokunmadan mümkün olur.
 */

export interface AdPolicyConfig {
  /** Reklam sistemi tamamen açık mı. */
  readonly enabled: boolean;
  /** Hangi yerleşimler etkin (bugün yalnızca postroll kullanılıyor). */
  readonly placements: readonly AdPlacement[];
  /**
   * Kaç bölümde bir reklam gösterilsin. 1 = her bölüm sonunda.
   * 3 = her 3 bölümden birinde.
   */
  readonly everyNEpisodes: number;
  /**
   * İki reklam kesintisi arasında geçmesi gereken en az süre (ms).
   * Kısa bölümler peş peşe dinlenirken reklam yağmasını önler.
   */
  readonly minIntervalMs: number;
  /**
   * Bu süreden kısa bölümlerde reklam gösterilmez (saniye).
   * Çok kısa içerikte reklam oransız kalır.
   */
  readonly minEpisodeDurationSec: number;
}

export const DEFAULT_AD_POLICY: AdPolicyConfig = {
  enabled: false, // reklam sunucusu yapılandırılana kadar kapalı
  placements: ['postroll'],
  everyNEpisodes: 1,
  minIntervalMs: 5 * 60_000, // 5 dakika
  minEpisodeDurationSec: 120, // 2 dakikadan kısa bölümlerde reklam yok
};

/** Politikanın kararını verirken baktığı sayaç/zaman durumu. */
export interface AdPolicyState {
  /** Son reklamdan bu yana tamamlanan bölüm sayısı. */
  readonly episodesSinceLastAd: number;
  /** Son reklam kesintisinin zamanı (epoch ms); hiç gösterilmediyse 0. */
  readonly lastAdAtMs: number;
}

export const INITIAL_AD_POLICY_STATE: AdPolicyState = {
  episodesSinceLastAd: 0,
  lastAdAtMs: 0,
};

/**
 * Verilen yerleşimde reklam istenmeli mi?
 *
 * Saf fonksiyon: aynı girdi → aynı çıktı. Zamanı dışarıdan alır (`nowMs`) ki
 * test edilebilir olsun.
 */
export const shouldRequestAd = (
  config: AdPolicyConfig,
  state: AdPolicyState,
  input: { placement: AdPlacement; episodeDurationSec: number; nowMs: number },
): boolean => {
  if (!config.enabled) {
    return false;
  }
  if (!config.placements.includes(input.placement)) {
    return false;
  }
  if (input.episodeDurationSec > 0 && input.episodeDurationSec < config.minEpisodeDurationSec) {
    return false;
  }
  // Sayaç: N bölümde bir. (episodesSinceLastAd, bu bölüm dahil sayılır.)
  if (state.episodesSinceLastAd < Math.max(1, config.everyNEpisodes)) {
    return false;
  }
  // Zaman aralığı: çok yakın zamanda reklam gösterildiyse atla.
  if (state.lastAdAtMs > 0 && input.nowMs - state.lastAdAtMs < config.minIntervalMs) {
    return false;
  }
  return true;
};

/** Bir bölüm tamamlandığında sayacı ilerletir. */
export const onEpisodeCompleted = (state: AdPolicyState): AdPolicyState => ({
  ...state,
  episodesSinceLastAd: state.episodesSinceLastAd + 1,
});

/** Reklam gösterildiğinde sayaçları sıfırlar. */
export const onAdShown = (state: AdPolicyState, nowMs: number): AdPolicyState => ({
  episodesSinceLastAd: 0,
  lastAdAtMs: nowMs,
});
