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
import { PushService } from './modules/push/PushService';
import { SyncService } from './modules/sync/SyncService';
import { TransistorProxy } from './modules/transistor/TransistorProxy';
import { MemoryStore } from './storage/MemoryStore';
import { SqliteStore } from './storage/SqliteStore';
import type { Store } from './storage/Store';

export interface App {
  readonly router: Router;
  readonly store: Store;
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

  // --- Transistor proxy --------------------------------------------------
  // API anahtarı sunucuda kalır; istemci anahtarsız çalışır.
  router.get('/v1/transistor/:resource', async ctx => {
    const body = await transistor.forward(ctx.params.resource, ctx.query);
    return { status: 200, body, headers: { 'Content-Type': 'application/json; charset=utf-8' } };
  });

  return { router, store };
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
