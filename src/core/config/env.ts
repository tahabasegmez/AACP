/**
 * Uygulama ortam ayarları.
 *
 * Şimdilik sabit; ileride react-native-config / farklı build şemaları ile
 * (dev / staging / prod) beslenebilir. Tek erişim noktası olması önemli.
 */
export interface AppEnv {
  /** RSS/HTTP istekleri için varsayılan zaman aşımı (ms). */
  readonly requestTimeoutMs: number;
  /** Feed cache geçerlilik süresi (ms). */
  readonly feedCacheTtlMs: number;
  /** Ağ hatalarında yeniden deneme sayısı. */
  readonly networkRetryCount: number;
}

export const env: AppEnv = {
  requestTimeoutMs: 15_000,
  feedCacheTtlMs: 10 * 60_000, // 10 dakika
  networkRetryCount: 2,
};
