/**
 * Sunucu ortam ayarları — TEK okuma noktası.
 *
 * Tüm değerler ortam değişkenlerinden gelir; kodda hiçbir makineye/kuruma özgü
 * sabit yoktur. Böylece aynı imaj Raspberry Pi'de, kurumsal sunucuda veya
 * kiralık bir VPS'te değişiklik yapmadan çalışır.
 */

const int = (value: string | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};

const bool = (value: string | undefined, fallback: boolean): boolean => {
  if (value == null || value.trim() === '') {
    return fallback;
  }
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};

const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

export interface ServerEnv {
  readonly nodeEnv: 'development' | 'production' | 'test';
  /** Dinlenecek port. */
  readonly port: number;
  /** Dinlenecek adres — 0.0.0.0 tüm arayüzler (konteyner için gerekli). */
  readonly host: string;
  /** Veri dosyalarının kök dizini (SQLite + katalog). Kalıcı volume'e bağlanır. */
  readonly dataDir: string;
  /** Kalıcılık motoru: sqlite (varsayılan) veya memory (test/geçici). */
  readonly storageDriver: 'sqlite' | 'memory';
  /**
   * Erişim jetonlarını imzalamak için gizli anahtar. Üretimde MUTLAKA verilmeli;
   * verilmezse süreç başlangıcında rastgele üretilir (yeniden başlatınca
   * oturumlar düşer) ve uyarı basılır.
   */
  readonly authSecret?: string;
  /** Jeton geçerlilik süresi (saniye). */
  readonly tokenTtlSec: number;
  /** Yönetim uçları (katalog yazma) için anahtar. Boşsa yazma kapalıdır. */
  readonly adminToken?: string;
  /** CORS'a izin verilen kökenler; boşsa CORS başlığı gönderilmez. */
  readonly corsOrigins: readonly string[];
  /** Transistor proxy için API anahtarı (istemciye anahtar sızmasın diye). */
  readonly transistorApiKey?: string;
  /** Transistor API kök adresi. */
  readonly transistorBaseUrl: string;
  /** Dakikada IP başına izin verilen istek sayısı. */
  readonly rateLimitPerMin: number;
  /** Telemetri toplama açık mı. */
  readonly analyticsEnabled: boolean;
  /**
   * Takip edilen feed'lerde yeni bölüm taraması aralığı (ms).
   * 0 veya negatif → tarayıcı devre dışı.
   */
  readonly feedWatchIntervalMs: number;

  // --- APNs (iOS push) ------------------------------------------------------
  /** `.p8` anahtar içeriği (PEM). Boşsa push gönderimi kapalıdır. */
  readonly apnsKey?: string;
  readonly apnsKeyId?: string;
  readonly apnsTeamId?: string;
  /** Uygulamanın bundle kimliği (apns-topic). */
  readonly apnsBundleId?: string;
  /** Üretim APNs sunucusu mu kullanılsın (false → sandbox). */
  readonly apnsProduction: boolean;
}

export const loadEnv = (source: NodeJS.ProcessEnv = process.env): ServerEnv => {
  const nodeEnv = (source.NODE_ENV as ServerEnv['nodeEnv']) ?? 'development';
  return {
    nodeEnv: ['development', 'production', 'test'].includes(nodeEnv) ? nodeEnv : 'development',
    port: int(source.PORT, 8080),
    host: source.HOST?.trim() || '0.0.0.0',
    dataDir: source.DATA_DIR?.trim() || './data',
    storageDriver: source.STORAGE_DRIVER?.trim() === 'memory' ? 'memory' : 'sqlite',
    authSecret: source.AUTH_SECRET?.trim() || undefined,
    tokenTtlSec: int(source.TOKEN_TTL_SEC, 30 * 24 * 60 * 60), // 30 gün
    adminToken: source.ADMIN_TOKEN?.trim() || undefined,
    corsOrigins: list(source.CORS_ORIGINS),
    transistorApiKey: source.TRANSISTOR_API_KEY?.trim() || undefined,
    transistorBaseUrl: source.TRANSISTOR_BASE_URL?.trim() || 'https://api.transistor.fm/v1',
    rateLimitPerMin: int(source.RATE_LIMIT_PER_MIN, 120),
    analyticsEnabled: bool(source.ANALYTICS_ENABLED, true),
    feedWatchIntervalMs: Number(source.FEED_WATCH_INTERVAL_MS ?? 30 * 60_000) || 0,
    // `.p8` içeriği .env'de tek satır olarak taşınabilsin diye `\n` çözülür.
    apnsKey: source.APNS_KEY?.trim().replace(/\\n/g, '\n') || undefined,
    apnsKeyId: source.APNS_KEY_ID?.trim() || undefined,
    apnsTeamId: source.APNS_TEAM_ID?.trim() || undefined,
    apnsBundleId: source.APNS_BUNDLE_ID?.trim() || undefined,
    apnsProduction: bool(source.APNS_PRODUCTION, false),
  };
};
