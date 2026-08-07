"use strict";
/**
 * Sunucu ortam ayarları — TEK okuma noktası.
 *
 * Tüm değerler ortam değişkenlerinden gelir; kodda hiçbir makineye/kuruma özgü
 * sabit yoktur. Böylece aynı imaj Raspberry Pi'de, kurumsal sunucuda veya
 * kiralık bir VPS'te değişiklik yapmadan çalışır.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnv = void 0;
const int = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
};
const bool = (value, fallback) => {
    if (value == null || value.trim() === '') {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
};
const list = (value) => (value ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const loadEnv = (source = process.env) => {
    const nodeEnv = source.NODE_ENV ?? 'development';
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
exports.loadEnv = loadEnv;
//# sourceMappingURL=env.js.map