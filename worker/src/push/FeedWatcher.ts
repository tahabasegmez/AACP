import type { Env } from '../env';
import { Supabase, type SupabaseScope } from '../supabase';
import { ShowScanner, type ScanOutcome, type ScannableShow } from './ShowScanner';

/** Kuyruğa konan tek iş. */
export interface FeedScanJob {
  readonly show: ScannableShow;
  readonly backfill: boolean;
}

export interface ScanSummary {
  readonly checked: number;
  readonly unchanged: number;
  readonly ingested: number;
  readonly notified: number;
  readonly failed: number;
  /** İşler kuyruğa mı verildi, burada mı çalıştırıldı? */
  readonly mode: 'queued' | 'inline';
}

/**
 * Tek turda sırayla taranacak en fazla şov.
 *
 * Kuyruk bağlı değilken geçerlidir ve cron penceresini korur. Kuyruk varken
 * böyle bir sınır gerekmez: işler paralel tüketicilere dağılır.
 */
const INLINE_LIMIT = 50;

/**
 * FeedWatcher — taramayı DAĞITIR, kendisi tarama yapmaz.
 *
 * Şov sayısı büyüdükçe "hepsini tek cron turunda sırayla tara" yaklaşımı
 * çöker: 5.000 şov × ~1 sn, hiçbir çalıştırma penceresine sığmaz. Bu yüzden
 * her şov KUYRUĞA ayrı bir iş olarak konur; Cloudflare tüketicileri paralel
 * çalıştırır, başarısız iş kendi başına yeniden denenir ve bir şovun hatası
 * diğerlerini etkilemez.
 *
 * Kuyruk bağlı değilse (yerel geliştirme, eksik yapılandırma) işler sınırlı
 * sayıda ve sırayla burada çalıştırılır. Eksik yapılandırma servisi
 * düşürmemeli; yalnızca ölçek özelliği devre dışı kalmalıdır.
 */
export class FeedWatcher {
  private readonly scanner: ShowScanner;

  constructor(private readonly env: Env) {
    this.scanner = new ShowScanner(env);
  }

  /**
   * @param backfill Tüm arşivi işle (yeni şov eklendiğinde bir kez).
   */
  async runOnce(backfill = false): Promise<ScanSummary> {
    const scope = Supabase.from(this.env).asService();
    const shows = await this.loadCatalog(scope);

    if (this.env.FEED_SCAN) {
      await this.enqueue(shows, backfill);
      return {
        checked: shows.length,
        unchanged: 0,
        ingested: 0,
        notified: 0,
        failed: 0,
        mode: 'queued',
      };
    }

    return summarize(
      await this.scanInline(shows.slice(0, INLINE_LIMIT), backfill),
      'inline',
    );
  }

  /** Kuyruktan gelen tek işi çalıştırır. */
  async runJob(job: FeedScanJob): Promise<ScanOutcome> {
    return this.scanner.scan(job.show, job.backfill);
  }

  /**
   * İşleri kuyruğa verir.
   *
   * Toplu gönderim kullanılır: her şov için ayrı istek atmak, üretici tarafını
   * yeniden lineer yapardı.
   */
  private async enqueue(shows: readonly ScannableShow[], backfill: boolean): Promise<void> {
    const queue = this.env.FEED_SCAN;
    if (!queue) {
      return;
    }
    const messages = shows.map(show => ({ body: { show, backfill } }));

    for (let start = 0; start < messages.length; start += QUEUE_BATCH) {
      await queue.sendBatch(messages.slice(start, start + QUEUE_BATCH));
    }
  }

  /** Kuyruk yokken: sınırlı sayıda şovu sırayla tarar. */
  private async scanInline(
    shows: readonly ScannableShow[],
    backfill: boolean,
  ): Promise<ScanOutcome[]> {
    const outcomes: ScanOutcome[] = [];
    for (const show of shows) {
      try {
        outcomes.push(await this.scanner.scan(show, backfill));
      } catch (error) {
        // Bir şovdaki hata diğerlerini etkilemez.
        outcomes.push({
          slug: show.slug,
          unchanged: false,
          ingested: 0,
          notified: 0,
          failed: error instanceof Error ? error.message : 'bilinmeyen hata',
        });
      }
    }
    return outcomes;
  }

  /** Yayındaki şovlar ve saklanan doğrulayıcıları. */
  private async loadCatalog(scope: SupabaseScope): Promise<ScannableShow[]> {
    const rows = await scope.select<{
      slug: string;
      feed_url: string;
      title: string;
      feed_etag: string | null;
      feed_modified: string | null;
    }>('shows', 'select=slug,feed_url,title,feed_etag,feed_modified&active=is.true');

    return rows.map(row => ({
      slug: row.slug,
      feedUrl: row.feed_url,
      title: row.title,
      validators: {
        etag: row.feed_etag ?? undefined,
        lastModified: row.feed_modified ?? undefined,
      },
    }));
  }
}

/** Cloudflare'in tek `sendBatch` çağrısında kabul ettiği en fazla mesaj. */
const QUEUE_BATCH = 100;

/** Tekil sonuçları tek özete indirir. */
export const summarize = (
  outcomes: readonly ScanOutcome[],
  mode: ScanSummary['mode'],
): ScanSummary => ({
  checked: outcomes.length,
  unchanged: outcomes.filter(o => o.unchanged).length,
  ingested: outcomes.reduce((total, o) => total + o.ingested, 0),
  notified: outcomes.reduce((total, o) => total + o.notified, 0),
  failed: outcomes.filter(o => o.failed).length,
  mode,
});
