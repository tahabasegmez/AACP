import { HttpError } from '../errors';
import type { RedisClient } from './RedisSyncStore';

/** Pipeline yanıtındaki tek sonuç. */
interface PipelineResult {
  readonly result?: unknown;
  readonly error?: string;
}

/**
 * HttpRedisClient — Redis'e HTTP üzerinden konuşan istemci (Upstash uyumlu).
 *
 * Workers'ta TCP soketiyle Redis'e bağlanmak mümkün değildir; sağlayıcıların
 * REST arayüzü kullanılır. Bağımlılık eklenmez: ihtiyaç yüzeyi tek uçtan
 * ibaret (`/pipeline`), SDK getirmek bundle'ı ve bakım yükünü büyütürdü.
 *
 * Komutlar DAİMA pipeline ile gönderilir; tek komutluk çağrılar da öyle.
 * Böylece argümanlar gövdede JSON olarak taşınır ve anahtar/değerlerin URL
 * içinde kaçırılması sorunu hiç doğmaz.
 */
export class HttpRedisClient implements RedisClient {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  async pipeline(commands: readonly (readonly string[])[]): Promise<unknown[]> {
    const response = await fetch(`${this.url.replace(/\/+$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw HttpError.internal(`Redis hatası (${response.status}): ${text.slice(0, 200)}`);
    }

    const results = (await response.json()) as PipelineResult[];
    if (!Array.isArray(results)) {
      throw HttpError.internal('Redis yanıtı beklenen biçimde değil');
    }

    return results.map(entry => {
      // Tek komutun hatası sessizce yutulursa senkron veri kaybı gizlenirdi.
      if (entry?.error) {
        throw HttpError.internal(`Redis komutu başarısız: ${entry.error}`);
      }
      return entry?.result;
    });
  }
}
