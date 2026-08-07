"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const errors_1 = require("./core/errors");
const middleware_1 = require("./core/http/middleware");
const router_1 = require("./core/http/router");
const types_1 = require("./core/http/types");
const AnalyticsService_1 = require("./modules/analytics/AnalyticsService");
const AuthService_1 = require("./modules/auth/AuthService");
const CatalogService_1 = require("./modules/catalog/CatalogService");
const ApnsPushSender_1 = require("./modules/push/ApnsPushSender");
const FeedWatcher_1 = require("./modules/push/FeedWatcher");
const PushScheduler_1 = require("./modules/push/PushScheduler");
const PushSender_1 = require("./modules/push/PushSender");
const PushService_1 = require("./modules/push/PushService");
const SyncService_1 = require("./modules/sync/SyncService");
const TransistorProxy_1 = require("./modules/transistor/TransistorProxy");
const MemoryStore_1 = require("./storage/MemoryStore");
const SqliteStore_1 = require("./storage/SqliteStore");
/**
 * COMPOSITION ROOT (sunucu) — tüm somut bağımlılıklar burada kurulur ve
 * rotalara bağlanır. Servisler birbirini `new`'lemez; yalnızca burada bağlanır.
 *
 * API yüzeyi sürüm öneki taşır (`/v1/...`): ileride kırıcı bir değişiklik
 * gerekirse `/v2` yan yana yaşayabilir ve eski istemciler çalışmaya devam eder.
 */
const createApp = (env, logger) => {
    const store = env.storageDriver === 'memory' ? new MemoryStore_1.MemoryStore() : new SqliteStore_1.SqliteStore(env.dataDir);
    // Gizli anahtar verilmediyse süreç ömrü boyunca geçerli rastgele bir anahtar
    // üretilir — geliştirme kolaylığı; üretimde AUTH_SECRET zorunlu sayılmalı.
    const secret = env.authSecret ?? node_crypto_1.default.randomBytes(32).toString('hex');
    if (!env.authSecret && env.nodeEnv === 'production') {
        logger.warn('AUTH_SECRET verilmedi — yeniden başlatmada tüm oturumlar düşer');
    }
    const auth = new AuthService_1.AuthService(store, secret, env.tokenTtlSec);
    const catalog = new CatalogService_1.CatalogService(store, env.dataDir);
    const sync = new SyncService_1.SyncService(store);
    const analytics = new AnalyticsService_1.AnalyticsService(store, env.analyticsEnabled);
    const push = new PushService_1.PushService(store);
    const transistor = new TransistorProxy_1.TransistorProxy(env.transistorBaseUrl, env.transistorApiKey);
    // Yeni bölüm bildirimi: tarayıcı + zamanlayıcı.
    // APNs yapılandırılmışsa gerçek gönderici, değilse kuru çalıştırma (log).
    const apns = new ApnsPushSender_1.ApnsPushSender({
        key: env.apnsKey ?? '',
        keyId: env.apnsKeyId ?? '',
        teamId: env.apnsTeamId ?? '',
        bundleId: env.apnsBundleId ?? '',
        production: env.apnsProduction,
    }, logger, 
    // Geçersiz cihaz jetonları kayıttan düşürülür.
    token => store.removePushRegistration(token));
    const pushSender = apns.enabled ? apns : new PushSender_1.LoggingPushSender(logger);
    const feedWatcher = new FeedWatcher_1.FeedWatcher(store, catalog, pushSender, logger);
    const scheduler = new PushScheduler_1.PushScheduler(feedWatcher, logger, env.feedWatchIntervalMs);
    const router = new router_1.Router(logger)
        .use((0, middleware_1.cors)(env.corsOrigins))
        .use((0, middleware_1.rateLimit)(env.rateLimitPerMin))
        .use((0, middleware_1.authenticate)(header => auth.userIdFromHeader(header)));
    // --- sağlık ------------------------------------------------------------
    router.get('/health', () => (0, types_1.ok)({ status: 'ok', env: env.nodeEnv, time: new Date().toISOString() }));
    // --- kimlik ------------------------------------------------------------
    // Cihaz kimliğiyle anonim oturum: hesap/şifre gerektirmeden senkron açılır.
    router.post('/v1/auth/device', async (ctx) => {
        const body = (ctx.body ?? {});
        return (0, types_1.created)(await auth.authenticateDevice(body.deviceId ?? ''));
    });
    // Hesap oluşturma. Oturumdaki (anonim) kullanıcı varsa YÜKSELTİLİR; böylece
    // anonimken biriken veri hesaba taşınır, ayrı bir göç adımı gerekmez.
    router.post('/v1/auth/register', async (ctx) => {
        const body = (ctx.body ?? {});
        const currentUserId = auth.userIdFromHeader(ctx.headers.authorization);
        return (0, types_1.created)(await auth.register(body.email ?? '', body.password ?? '', currentUserId));
    });
    // E-posta + şifre ile giriş.
    router.post('/v1/auth/login', async (ctx) => {
        const body = (ctx.body ?? {});
        return (0, types_1.ok)(await auth.signIn(body.email ?? '', body.password ?? ''));
    });
    // Oturumdaki kullanıcının profili.
    router.get('/v1/auth/me', async (ctx) => {
        const userId = auth.requireUserId(ctx.headers.authorization);
        return (0, types_1.ok)(await auth.profile(userId));
    });
    router.post('/v1/auth/profile', async (ctx) => {
        const userId = auth.requireUserId(ctx.headers.authorization);
        const body = (ctx.body ?? {});
        return (0, types_1.ok)(await auth.updateProfile(userId, body.displayName));
    });
    // --- katalog -----------------------------------------------------------
    // Uygulamanın okuduğu uç: shows.json ile aynı şekil (FeedCatalogEntry dizisi).
    router.get('/v1/catalog', async () => (0, types_1.ok)(await catalog.get()));
    // Yönetim: kataloğu yayınla. ADMIN_TOKEN tanımlı değilse yazma kapalıdır.
    router.post('/v1/catalog', async (ctx) => {
        requireAdmin(ctx.headers['x-admin-token'], env.adminToken);
        return (0, types_1.ok)(await catalog.publish(ctx.body));
    });
    // --- senkron -----------------------------------------------------------
    router.get('/v1/sync/:collection', async (ctx) => {
        const userId = auth.requireUserId(ctx.headers.authorization);
        const since = Number(ctx.query.get('since') ?? 0);
        return (0, types_1.ok)(await sync.pull(userId, ctx.params.collection, since));
    });
    router.post('/v1/sync/:collection', async (ctx) => {
        const userId = auth.requireUserId(ctx.headers.authorization);
        const body = (ctx.body ?? {});
        return (0, types_1.ok)(await sync.push(userId, ctx.params.collection, body.records ?? []));
    });
    // --- telemetri ---------------------------------------------------------
    // Kimlik opsiyonel: anonim açılış olayları da toplanabilir.
    router.post('/v1/analytics', async (ctx) => {
        const body = (ctx.body ?? {});
        return (0, types_1.ok)(await analytics.ingest(ctx.userId, body.events ?? []));
    });
    // --- push kaydı --------------------------------------------------------
    router.post('/v1/push/register', async (ctx) => {
        const userId = auth.requireUserId(ctx.headers.authorization);
        return (0, types_1.ok)(await push.register(userId, ctx.body));
    });
    router.post('/v1/push/unregister', async (ctx) => {
        auth.requireUserId(ctx.headers.authorization);
        await push.unregister(ctx.body);
        return (0, types_1.noContent)();
    });
    // Yönetim: feed taramasını elle tetikle (kurulum doğrulaması için).
    router.post('/v1/push/scan', async (ctx) => {
        requireAdmin(ctx.headers['x-admin-token'], env.adminToken);
        return (0, types_1.ok)(await feedWatcher.runOnce());
    });
    // --- Transistor proxy --------------------------------------------------
    // API anahtarı sunucuda kalır; istemci anahtarsız çalışır.
    router.get('/v1/transistor/:resource', async (ctx) => {
        const body = await transistor.forward(ctx.params.resource, ctx.query);
        return { status: 200, body, headers: { 'Content-Type': 'application/json; charset=utf-8' } };
    });
    return { router, store, scheduler };
};
exports.createApp = createApp;
/** Yönetim uçları: ADMIN_TOKEN tanımlı değilse tamamen kapalıdır. */
const requireAdmin = (provided, expected) => {
    if (!expected) {
        throw errors_1.HttpError.forbidden('Yönetim uçları kapalı (ADMIN_TOKEN tanımlı değil)');
    }
    const value = Array.isArray(provided) ? provided[0] : provided;
    if (!value || value.length !== expected.length) {
        throw errors_1.HttpError.unauthorized('Geçersiz yönetim anahtarı');
    }
    // Sabit süreli karşılaştırma — anahtar sızıntısını zorlaştırır.
    if (!node_crypto_1.default.timingSafeEqual(Buffer.from(value), Buffer.from(expected))) {
        throw errors_1.HttpError.unauthorized('Geçersiz yönetim anahtarı');
    }
};
//# sourceMappingURL=app.js.map