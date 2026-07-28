/**
 * Uygulama ortam ayarları.
 *
 * TEK erişim noktası: kod hiçbir yerde URL/anahtar sabiti yazmaz, `env` okur.
 *
 * Ortam seçimi `APP_ENV` (react-native-config → kökteki `.env`) ile yapılır;
 * yoksa __DEV__ bayrağına göre dev/prod seçilir. Böylece aynı kod dev, staging
 * ve prod'da değişiklik yapmadan çalışır — yalnızca `apiBaseUrl` farklıdır.
 *
 * API, Cloudflare Workers üzerinde çalışır (bkz. worker/); sağlayıcı değişse
 * bile uygulama tarafında yalnızca bu adres değişir.
 */

/** Bölüm listesinin hangi kaynaktan çözüleceği. */
export type EpisodeSourceKind = 'rss' | 'transistor';

export interface AppEnv {
  /** Ortam adı — loglama/telemetri etiketlemesi için. */
  readonly name: 'development' | 'staging' | 'production';

  /** RSS/HTTP istekleri için varsayılan zaman aşımı (ms). */
  readonly requestTimeoutMs: number;
  /** Feed cache geçerlilik süresi (ms). */
  readonly feedCacheTtlMs: number;
  /** Ağ hatalarında yeniden deneme sayısı. */
  readonly networkRetryCount: number;

  /**
   * AACP backend'inin kök adresi (ör. https://podcast.example.com/api).
   * Boşsa uygulama tamamen sunucusuz (yerel) çalışır: senkron, telemetri ve
   * uzak katalog devre dışı kalır, hiçbir özellik kırılmaz.
   */
  readonly apiBaseUrl?: string;

  /**
   * Uzak (remote-config) şov kataloğu JSON URL'i. Verilmezse `apiBaseUrl`
   * üzerinden `/v1/catalog` kullanılır; o da yoksa yalnızca bundled katalog.
   */
  readonly remoteCatalogUrl?: string;
  /** Uzak katalog cache geçerlilik süresi (ms). */
  readonly remoteCatalogTtlMs: number;

  /** Bölümler nereden okunacak: RSS feed (varsayılan) veya Transistor API. */
  readonly episodeSource: EpisodeSourceKind;
  /**
   * Transistor API anahtarı. Yalnızca `episodeSource: 'transistor'` iken gerekir.
   * İstemciye anahtar gömmek yerine backend proxy'si (apiBaseUrl) önerilir;
   * bu alan doğrudan-erişim senaryosu (ör. dahili build) içindir.
   */
  readonly transistorApiKey?: string;

  /** Kullanım telemetrisi gönderilsin mi (apiBaseUrl gerektirir). */
  readonly analyticsEnabled: boolean;
  /** Cihazlar arası senkron açık mı (apiBaseUrl gerektirir). */
  readonly syncEnabled: boolean;

  /**
   * VAST reklam etiketi (ad tag) URL'i. Reklam sunucusundan alınır.
   * BOŞSA reklam sistemi tamamen kapalıdır — oynatma akışı hiç değişmez.
   *
   * Yer tutucular istek anında doldurulur:
   *   {placement} {episodeId} {showId} {duration} {timestamp} {random}
   *
   * Örnek:
   *   https://ads.example.com/vast?pos={placement}&ep={episodeId}&cb={random}
   */
  readonly adTagUrl?: string;
  /** Kaç bölümde bir reklam gösterilsin (1 = her bölüm sonunda). */
  readonly adEveryNEpisodes: number;
}

/** Tüm ortamlarda ortak, teknoloji kaynaklı varsayılanlar. */
const base = {
  requestTimeoutMs: 15_000,
  feedCacheTtlMs: 10 * 60_000, // 10 dakika
  networkRetryCount: 2,
  remoteCatalogTtlMs: 6 * 60 * 60_000, // 6 saat
  episodeSource: 'rss' as EpisodeSourceKind,
  adEveryNEpisodes: 1,
} as const;

/**
 * Ortam tanımları. Sunucu adresleri build zamanında `APP_API_BASE_URL` ile
 * geçersiz kılınabilir (react-native-config); bu sayede aynı binary farklı
 * sunuculara yönlendirilebilir ve kod değişmez.
 */
const ENVIRONMENTS: Record<AppEnv['name'], AppEnv> = {
  development: {
    ...base,
    name: 'development',
    apiBaseUrl: undefined, // .env → APP_API_BASE_URL ile verilir
    // Telemetri geliştirmede kapalı: test kullanımı raporları kirletmesin.
    analyticsEnabled: false,
    // Senkron AÇIK: bir sunucu adresi verildiyse kullanıcı onu denemek
    // istiyordur. Adres yoksa `isSyncEnabled` zaten kapalı döner.
    syncEnabled: true,
  },
  staging: {
    ...base,
    name: 'staging',
    apiBaseUrl: undefined,
    analyticsEnabled: true,
    syncEnabled: true,
  },
  production: {
    ...base,
    name: 'production',
    apiBaseUrl: undefined,
    analyticsEnabled: true,
    syncEnabled: true,
  },
};

/** Build zamanı override'ları (react-native-config veya babel inject). */
interface RawOverrides {
  APP_ENV?: string;
  APP_API_BASE_URL?: string;
  APP_CATALOG_URL?: string;
  APP_EPISODE_SOURCE?: string;
  APP_TRANSISTOR_API_KEY?: string;
  APP_AD_TAG_URL?: string;
  /** "false" ile senkronu kapatır (ortam varsayılanını geçersiz kılar). */
  APP_SYNC_ENABLED?: string;
}

/**
 * Build değişkenlerini güvenle okur (`react-native-config` → kökteki `.env`).
 *
 * Paket bulunamazsa sessizce boş döner ve preset'ler kullanılır; böylece
 * `.env` dosyası olmayan bir kurulumda da uygulama çalışır.
 */
const readOverrides = (): RawOverrides => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-config') as { default?: RawOverrides };
    return mod.default ?? (mod as RawOverrides);
  } catch {
    return {};
  }
};

const isEnvName = (v: unknown): v is AppEnv['name'] =>
  v === 'development' || v === 'staging' || v === 'production';

const isSourceKind = (v: unknown): v is EpisodeSourceKind =>
  v === 'rss' || v === 'transistor';

const trimmed = (v?: string): string | undefined => {
  const s = v?.trim();
  return s && s.length > 0 ? s : undefined;
};

/** Aktif ortamı kurar: taban tanım + build zamanı override'ları. */
const resolveEnv = (): AppEnv => {
  const raw = readOverrides();
  const fallback: AppEnv['name'] =
    typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production';
  const name = isEnvName(raw.APP_ENV) ? raw.APP_ENV : fallback;
  const preset = ENVIRONMENTS[name];

  return {
    ...preset,
    apiBaseUrl: trimmed(raw.APP_API_BASE_URL) ?? preset.apiBaseUrl,
    remoteCatalogUrl: trimmed(raw.APP_CATALOG_URL) ?? preset.remoteCatalogUrl,
    episodeSource: isSourceKind(raw.APP_EPISODE_SOURCE)
      ? raw.APP_EPISODE_SOURCE
      : preset.episodeSource,
    transistorApiKey: trimmed(raw.APP_TRANSISTOR_API_KEY) ?? preset.transistorApiKey,
    adTagUrl: trimmed(raw.APP_AD_TAG_URL) ?? preset.adTagUrl,
    syncEnabled: flag(raw.APP_SYNC_ENABLED) ?? preset.syncEnabled,
  };
};

/** "true"/"false" metnini bayrağa çevirir; verilmemişse undefined. */
const flag = (value?: string): boolean | undefined => {
  const v = value?.trim().toLowerCase();
  if (v === 'true' || v === '1') {
    return true;
  }
  if (v === 'false' || v === '0') {
    return false;
  }
  return undefined;
};

export const env: AppEnv = resolveEnv();

/**
 * Katalog JSON adresini çözer: açık `remoteCatalogUrl` > backend `/v1/catalog`
 * > yok (bundled-only). Tek yerde hesaplanır ki DI ve testler aynı kuralı görsün.
 */
export const resolveCatalogUrl = (e: AppEnv = env): string | undefined => {
  if (e.remoteCatalogUrl) {
    return e.remoteCatalogUrl;
  }
  return e.apiBaseUrl ? `${e.apiBaseUrl.replace(/\/+$/, '')}/v1/catalog` : undefined;
};

/** Sunucu gerektiren özellikler yalnızca apiBaseUrl varken açılır. */
export const isBackendEnabled = (e: AppEnv = env): boolean => Boolean(e.apiBaseUrl);
export const isSyncEnabled = (e: AppEnv = env): boolean => e.syncEnabled && isBackendEnabled(e);
export const isAnalyticsEnabled = (e: AppEnv = env): boolean =>
  e.analyticsEnabled && isBackendEnabled(e);

/**
 * Reklam sistemi yalnızca bir ad tag URL'i verildiğinde açılır.
 * Verilmezse oynatma akışı reklamsız çalışır (varsayılan).
 */
export const isAdsEnabled = (e: AppEnv = env): boolean => Boolean(e.adTagUrl);
