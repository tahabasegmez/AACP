import crypto from 'node:crypto';
import type { ServerEnv } from './config/env';
import { HttpError } from './core/errors';
import { authenticate, cors, rateLimit } from './core/http/middleware';
import { Router } from './core/http/router';
import { created, noContent, ok } from './core/http/types';
import type { Logger } from './core/logger';
import { AnalyticsService } from './modules/analytics/AnalyticsService';
import { AuthService } from './modules/auth/AuthService';
import { CatalogService } from './modules/catalog/CatalogService';
import { ApnsPushSender } from './modules/push/ApnsPushSender';
import { FeedWatcher } from './modules/push/FeedWatcher';
import { PushScheduler } from './modules/push/PushScheduler';
import { LoggingPushSender } from './modules/push/PushSender';
import { PushService } from './modules/push/PushService';
import { SyncService } from './modules/sync/SyncService';
import { TransistorProxy } from './modules/transistor/TransistorProxy';
import { MemoryStore } from './storage/MemoryStore';
import { SqliteStore } from './storage/SqliteStore';
import type { Store } from './storage/Store';

export interface App {
  readonly router: Router;
  readonly store: Store;
  /** Yeni bölüm tarayıcısı — main.ts başlatır/durdurur. */
  readonly scheduler: PushScheduler;
}

/**
 * COMPOSITION ROOT (sunucu) — tüm somut bağımlılıklar burada kurulur ve
 * rotalara bağlanır. Servisler birbirini `new`'lemez; yalnızca burada bağlanır.
 *
 * API yüzeyi sürüm öneki taşır (`/v1/...`): ileride kırıcı bir değişiklik
 * gerekirse `/v2` yan yana yaşayabilir ve eski istemciler çalışmaya devam eder.
 */
export const createApp = (env: ServerEnv, logger: Logger): App => {
  const store: Store =
    env.storageDriver === 'memory' ? new MemoryStore() : new SqliteStore(env.dataDir);

  // Gizli anahtar verilmediyse süreç ömrü boyunca geçerli rastgele bir anahtar
  // üretilir — geliştirme kolaylığı; üretimde AUTH_SECRET zorunlu sayılmalı.
  const secret = env.authSecret ?? crypto.randomBytes(32).toString('hex');
  if (!env.authSecret && env.nodeEnv === 'production') {
    logger.warn('AUTH_SECRET verilmedi — yeniden başlatmada tüm oturumlar düşer');
  }

  const auth = new AuthService(store, secret, env.tokenTtlSec);
  const catalog = new CatalogService(store, env.dataDir);
  const sync = new SyncService(store);
  const analytics = new AnalyticsService(store, env.analyticsEnabled);
  const push = new PushService(store);
  const transistor = new TransistorProxy(env.transistorBaseUrl, env.transistorApiKey);

  // Yeni bölüm bildirimi: tarayıcı + zamanlayıcı.
  // APNs yapılandırılmışsa gerçek gönderici, değilse kuru çalıştırma (log).
  const apns = new ApnsPushSender(
    {
      key: env.apnsKey ?? '',
      keyId: env.apnsKeyId ?? '',
      teamId: env.apnsTeamId ?? '',
      bundleId: env.apnsBundleId ?? '',
      production: env.apnsProduction,
    },
    logger,
    // Geçersiz cihaz jetonları kayıttan düşürülür.
    token => store.removePushRegistration(token),
  );
  const pushSender = apns.enabled ? apns : new LoggingPushSender(logger);
  const feedWatcher = new FeedWatcher(store, catalog, pushSender, logger);
  const scheduler = new PushScheduler(feedWatcher, logger, env.feedWatchIntervalMs);

  const router = new Router(logger)
    .use(cors(env.corsOrigins))
    .use(rateLimit(env.rateLimitPerMin))
    .use(authenticate(header => auth.userIdFromHeader(header)));

  // --- sağlık ------------------------------------------------------------
  router.get('/health', () => ok({ status: 'ok', env: env.nodeEnv, time: new Date().toISOString() }));

  // --- kimlik ------------------------------------------------------------
  // Cihaz kimliğiyle anonim oturum: hesap/şifre gerektirmeden senkron açılır.
  router.post('/v1/auth/device', async ctx => {
    const body = (ctx.body ?? {}) as { deviceId?: string };
    return created(await auth.authenticateDevice(body.deviceId ?? ''));
  });

  // Hesap oluşturma. Oturumdaki (anonim) kullanıcı varsa YÜKSELTİLİR; böylece
  // anonimken biriken veri hesaba taşınır, ayrı bir göç adımı gerekmez.
  router.post('/v1/auth/register', async ctx => {
    const body = (ctx.body ?? {}) as { email?: string; password?: string };
    const currentUserId = auth.userIdFromHeader(ctx.headers.authorization);
    return created(
      await auth.register(body.email ?? '', body.password ?? '', currentUserId),
    );
  });

  // E-posta + şifre ile giriş.
  router.post('/v1/auth/login', async ctx => {
    const body = (ctx.body ?? {}) as { email?: string; password?: string };
    return ok(await auth.signIn(body.email ?? '', body.password ?? ''));
  });

  // Oturumdaki kullanıcının profili.
  router.get('/v1/auth/me', async ctx => {
    const userId = auth.requireUserId(ctx.headers.authorization);
    return ok(await auth.profile(userId));
  });

  router.post('/v1/auth/profile', async ctx => {
    const userId = auth.requireUserId(ctx.headers.authorization);
    const body = (ctx.body ?? {}) as { displayName?: string };
    return ok(await auth.updateProfile(userId, body.displayName));
  });

  // --- katalog -----------------------------------------------------------
  // Uygulamanın okuduğu uç: shows.json ile aynı şekil (FeedCatalogEntry dizisi).
  router.get('/v1/catalog', async () => ok(await catalog.get()));

  // Yönetim: kataloğu yayınla. ADMIN_TOKEN tanımlı değilse yazma kapalıdır.
  router.post('/v1/catalog', async ctx => {
    requireAdmin(ctx.headers['x-admin-token'], env.adminToken);
    return ok(await catalog.publish(ctx.body));
  });

  // --- senkron -----------------------------------------------------------
  router.get('/v1/sync/:collection', async ctx => {
    const userId = auth.requireUserId(ctx.headers.authorization);
    const since = Number(ctx.query.get('since') ?? 0);
    return ok(await sync.pull(userId, ctx.params.collection, since));
  });

  router.post('/v1/sync/:collection', async ctx => {
    const userId = auth.requireUserId(ctx.headers.authorization);
    const body = (ctx.body ?? {}) as { records?: unknown };
    return ok(await sync.push(userId, ctx.params.collection, body.records ?? []));
  });

  // --- telemetri ---------------------------------------------------------
  // Kimlik opsiyonel: anonim açılış olayları da toplanabilir.
  router.post('/v1/analytics', async ctx => {
    const body = (ctx.body ?? {}) as { events?: unknown };
    return ok(await analytics.ingest(ctx.userId, body.events ?? []));
  });

  // --- push kaydı --------------------------------------------------------
  router.post('/v1/push/register', async ctx => {
    const userId = auth.requireUserId(ctx.headers.authorization);
    return ok(await push.register(userId, ctx.body));
  });

  router.post('/v1/push/unregister', async ctx => {
    auth.requireUserId(ctx.headers.authorization);
    await push.unregister(ctx.body);
    return noContent();
  });

  // Yönetim: feed taramasını elle tetikle (kurulum doğrulaması için).
  router.post('/v1/push/scan', async ctx => {
    requireAdmin(ctx.headers['x-admin-token'], env.adminToken);
    return ok(await feedWatcher.runOnce());
  });

  // --- Transistor proxy --------------------------------------------------
  // API anahtarı sunucuda kalır; istemci anahtarsız çalışır.
  router.get('/v1/transistor/:resource', async ctx => {
    const body = await transistor.forward(ctx.params.resource, ctx.query);
    return { status: 200, body, headers: { 'Content-Type': 'application/json; charset=utf-8' } };
  });

  return { router, store, scheduler };
};

/** Yönetim uçları: ADMIN_TOKEN tanımlı değilse tamamen kapalıdır. */
const requireAdmin = (
  provided: string | string[] | undefined,
  expected: string | undefined,
): void => {
  if (!expected) {
    throw HttpError.forbidden('Yönetim uçları kapalı (ADMIN_TOKEN tanımlı değil)');
  }
  const value = Array.isArray(provided) ? provided[0] : provided;
  if (!value || value.length !== expected.length) {
    throw HttpError.unauthorized('Geçersiz yönetim anahtarı');
  }
  // Sabit süreli karşılaştırma — anahtar sızıntısını zorlaştırır.
  if (!crypto.timingSafeEqual(Buffer.from(value), Buffer.from(expected))) {
    throw HttpError.unauthorized('Geçersiz yönetim anahtarı');
  }
};
