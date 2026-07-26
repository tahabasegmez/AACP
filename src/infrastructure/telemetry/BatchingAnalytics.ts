import { Logger } from '@core/logger';
import { Analytics, AnalyticsEventName, AnalyticsPayload } from '@core/ports';
import { ApiClient } from '../api/ApiClient';

interface QueuedEvent {
  readonly name: AnalyticsEventName;
  readonly payload: AnalyticsPayload;
  readonly occurredAt: number;
}

/** Kuyruk bu boyuta ulaşınca hemen gönderilir. */
const FLUSH_THRESHOLD = 20;
/** Kuyrukta bekleyen olaylar en geç bu sürede gönderilir (ms). */
const FLUSH_INTERVAL_MS = 30_000;
/** Bellekte tutulan en fazla olay — ağ uzun süre yoksa sınırsız büyümesin. */
const MAX_QUEUE = 200;

/**
 * BatchingAnalytics — olayları biriktirip toplu gönderen Analytics adaptörü.
 *
 * `track()` asla beklemez ve asla hata fırlatmaz: telemetri, uygulama akışını
 * ne yavaşlatmalı ne de bozmalıdır. Gönderim başarısız olursa olaylar kuyrukta
 * kalır ve bir sonraki denemede tekrar gönderilir (üst sınıra kadar).
 */
export class BatchingAnalytics implements Analytics {
  private queue: QueuedEvent[] = [];
  private timer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly api: ApiClient,
    private readonly logger: Logger,
    private readonly enabled: boolean,
  ) {}

  track(name: AnalyticsEventName, payload: AnalyticsPayload = {}): void {
    if (!this.enabled) {
      return;
    }
    this.queue.push({ name, payload, occurredAt: Date.now() });

    // Taşma: en eski olaylar düşer (yeni veri daha değerli).
    if (this.queue.length > MAX_QUEUE) {
      this.queue = this.queue.slice(-MAX_QUEUE);
    }
    if (this.queue.length >= FLUSH_THRESHOLD) {
      void this.flush();
    } else {
      this.scheduleFlush();
    }
  }

  async flush(): Promise<void> {
    this.clearTimer();
    if (!this.enabled || this.queue.length === 0) {
      return;
    }

    const batch = this.queue;
    this.queue = [];
    try {
      await this.api.post('/v1/analytics', { events: batch });
    } catch (error) {
      // Gönderilemedi: olayları geri koy, bir sonraki turda denenecek.
      this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE);
      this.logger.warn('Telemetri gönderilemedi', error);
    }
  }

  private scheduleFlush(): void {
    if (this.timer) {
      return;
    }
    this.timer = setTimeout(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
  }
}

/** Telemetri kapalıyken kullanılan boş implementasyon (null object). */
export class NoopAnalytics implements Analytics {
  track(): void {}
  async flush(): Promise<void> {}
}
