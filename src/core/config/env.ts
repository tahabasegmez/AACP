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
  /**
   * Uzak (remote-config) şov kataloğu JSON URL'i. Boş bırakılırsa uygulama
   * yalnızca bundled (koda gömülü) katalogu kullanır — hibrit devre dışı.
   * Sunucu tarafı kurulum: docs/REMOTE_CONFIG.md
   */
  readonly remoteCatalogUrl?: string;
  /** Uzak katalog cache geçerlilik süresi (ms). */
  readonly remoteCatalogTtlMs: number;
}

export const env: AppEnv = {
  requestTimeoutMs: 15_000,
  feedCacheTtlMs: 10 * 60_000, // 10 dakika
  networkRetryCount: 2,
  // TODO: AA sunucusunda shows.json yayınlanınca burayı doldur (bkz. docs/REMOTE_CONFIG.md).
  remoteCatalogUrl: undefined,
  remoteCatalogTtlMs: 6 * 60 * 60_000, // 6 saat
};
