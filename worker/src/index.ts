import { requireAdmin } from './auth';
import { CatalogImportService } from './catalog/CatalogImportService';
import type { Env } from './env';
import { FeedWatcher, type FeedScanJob } from './push/FeedWatcher';
import { Router, ok } from './router';
import { registerAuthRoutes } from './routes/auth';
import { registerCatalogRoutes } from './routes/catalog';
import { registerMiscRoutes } from './routes/misc';
import { registerPlaybackRoutes } from './routes/playback';
import { registerShareRoutes } from './routes/share';
import { registerSyncRoutes } from './routes/sync';
import { storagePlacement } from './storage/resolveStore';

/**
 * AACP API — Cloudflare Workers girişi.
 *
 * İki giriş noktası vardır:
 *  - `fetch`: HTTP istekleri (uygulama bu uçlarla konuşur),
 *  - `scheduled`: Cron Trigger (yeni bölüm taraması).
 *
 * Router modül seviyesinde bir kez kurulur; her istekte yeniden oluşturmak
 * gereksiz iş olurdu (Worker örneği istekler arasında yaşar).
 */
const router = new Router();

registerAuthRoutes(router);
registerSyncRoutes(router);
registerCatalogRoutes(router);
registerPlaybackRoutes(router);
registerMiscRoutes(router);
// Paylaşılan bağlantıların karşılandığı sayfalar (derin bağlantı).
registerShareRoutes(router);

/** Sağlık kontrolü — dağıtımın ayakta olduğunu doğrular. */
router.get('/health', async ctx =>
  ok({
    status: 'ok',
    time: new Date().toISOString(),
    // Yapılandırmanın tamam olup olmadığını sızıntısız biçimde bildirir.
    supabase: Boolean(ctx.env.SUPABASE_URL && ctx.env.SUPABASE_ANON_KEY),
    push: Boolean(ctx.env.APNS_KEY && ctx.env.APNS_KEY_ID),
    // Koleksiyonların hangi depoda olduğu — KV bağlanmamışsa burada görünür.
    storage: storagePlacement(ctx.env),
  }),
);

/**
 * Yönetim: feed taramasını elle tetikle.
 *
 * `{ backfill: true }` ile ARŞİVİN TAMAMI işlenir — yeni bir şov eklendiğinde
 * bir kez çalıştırılır. Rutin cron turu bunu yapmaz (bkz. `SCAN_LIMIT`).
 */
router.post('/v1/push/scan', async ctx => {
  requireAdmin(ctx);
  const backfill = (ctx.body as { backfill?: unknown } | undefined)?.backfill === true;
  return ok(await new FeedWatcher(ctx.env).runOnce(backfill));
});

export default {
  async fetch(request: Request, env: Env, context: ExecutionContext): Promise<Response> {
    return router.handle(request, env, promise => context.waitUntil(promise));
  },

  /**
   * Cron Trigger — katalog tazeleme + yeni bölüm taraması.
   *
   * Katalog ÖNCE tazelenir: yayıncı yeni bir şov açtıysa aynı turda bölümleri
   * de taranır ve takipçilere bildirim gider. Sıra ters olsaydı yeni şov bir
   * tur gecikirdi.
   *
   * Hatalar yutulur: bir turun başarısız olması sonraki turu engellememelidir.
   */
  async scheduled(_event: ScheduledEvent, env: Env, context: ExecutionContext): Promise<void> {
    context.waitUntil(
      new CatalogImportService(env)
        .run()
        .then(result => console.log('katalog tazeleme', result))
        .catch(error => console.error('katalog tazeleme başarısız', error))
        .then(() => new FeedWatcher(env).runOnce())
        .then(result => console.log('feed taraması', result))
        .catch(error => console.error('feed taraması başarısız', error)),
    );
  },

  /**
   * Kuyruk tüketicisi — her mesaj TEK bir şovun taramasıdır.
   *
   * Mesajlar tek tek onaylanır/reddedilir: bir şovun feed'i çöktüğünde tüm
   * partiyi yeniden denemek, sağlam şovları da baştan taratırdı. Reddedilen
   * mesajı Cloudflare kendi geri çekilme (backoff) kuralıyla yeniden dener.
   */
  async queue(
    batch: { messages: QueueMessage<FeedScanJob>[] },
    env: Env,
  ): Promise<void> {
    const watcher = new FeedWatcher(env);

    await Promise.all(
      batch.messages.map(async message => {
        try {
          const outcome = await watcher.runJob(message.body);
          if (outcome.failed) {
            // Feed geçici olarak erişilemez olabilir; yeniden denenmeli.
            message.retry();
            return;
          }
          message.ack();
        } catch (error) {
          console.error('tarama işi başarısız', message.body.show.slug, error);
          message.retry();
        }
      }),
    );
  },
};

/** Kuyruk mesajının kullandığımız yüzeyi. */
interface QueueMessage<T> {
  readonly body: T;
  ack(): void;
  retry(): void;
}
