import crypto from 'node:crypto';
import http2 from 'node:http2';
import type { Logger } from '../../core/logger';
import type { PushMessage, PushSender } from './PushSender';

/** APNs sunucu adresleri. */
const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

/** Sağlayıcı jetonu en fazla 1 saat geçerlidir; erken yenilenir. */
const TOKEN_TTL_MS = 50 * 60_000;

export interface ApnsConfig {
  /** Apple Developer'dan indirilen `.p8` anahtarının İÇERİĞİ (PEM). */
  readonly key: string;
  /** Anahtarın Key ID'si. */
  readonly keyId: string;
  /** Apple Developer takım kimliği. */
  readonly teamId: string;
  /** Uygulamanın bundle kimliği (apns-topic). */
  readonly bundleId: string;
  /** Üretim mi sandbox mı. */
  readonly production: boolean;
}

/**
 * ApnsPushSender — bildirimleri Apple Push Notification service'e gönderir.
 *
 * Harici bir APNs kütüphanesi KULLANILMAZ: Apple'ın HTTP/2 + JWT protokolü
 * Node'un yerleşik `http2` ve `crypto` modülleriyle doğrudan konuşulabilir.
 * Böylece ARM (Raspberry Pi) dahil her yerde ek native derleme olmadan çalışır.
 *
 * Yapılandırma eksikse `enabled` false olur ve tarayıcı gönderim adımını
 * atlar — sunucu yine sorunsuz çalışır.
 *
 * Geçersiz jetonlar (410 Gone / BadDeviceToken) çağırana bildirilir ki
 * kayıtları temizlenebilsin.
 */
export class ApnsPushSender implements PushSender {
  private cachedToken?: { value: string; createdAt: number };

  constructor(
    private readonly config: ApnsConfig,
    private readonly logger: Logger,
    /** Geçersiz jetonu temizlemek için (kayıt silme). */
    private readonly onInvalidToken?: (token: string) => Promise<void>,
  ) {}

  get enabled(): boolean {
    return Boolean(this.config.key && this.config.keyId && this.config.teamId && this.config.bundleId);
  }

  async send(messages: readonly PushMessage[]): Promise<{ sent: number; failed: number }> {
    if (!this.enabled || messages.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const host = this.config.production ? HOSTS.production : HOSTS.sandbox;
    const client = http2.connect(host);
    let sent = 0;
    let failed = 0;

    try {
      const jwt = this.providerToken();
      // Tek bağlantı üzerinden paralel gönderim — HTTP/2 çoğullamanın amacı bu.
      const results = await Promise.all(
        messages
          .filter(m => m.platform === 'ios')
          .map(message => this.sendOne(client, jwt, message)),
      );
      for (const result of results) {
        if (result.ok) {
          sent += 1;
        } else {
          failed += 1;
        }
      }
    } catch (error) {
      this.logger.error('APNs gönderimi başarısız', { error: String(error) });
      failed += messages.length;
    } finally {
      client.close();
    }

    return { sent, failed };
  }

  /** Tek bir bildirimi gönderir; sonucu değerlendirir. */
  private sendOne(
    client: http2.ClientHttp2Session,
    jwt: string,
    message: PushMessage,
  ): Promise<{ ok: boolean }> {
    return new Promise(resolve => {
      const payload = JSON.stringify({
        aps: {
          alert: { title: message.title, body: message.body },
          sound: 'default',
        },
        ...message.data,
      });

      const request = client.request({
        ':method': 'POST',
        ':path': `/3/device/${message.token}`,
        authorization: `bearer ${jwt}`,
        'apns-topic': this.config.bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
        'content-length': Buffer.byteLength(payload),
      });

      let status = 0;
      let body = '';

      request.on('response', headers => {
        status = Number(headers[':status'] ?? 0);
      });
      request.on('data', chunk => {
        body += chunk;
      });
      request.on('error', error => {
        this.logger.warn('APNs isteği hatalı', { error: String(error) });
        resolve({ ok: false });
      });
      request.on('end', () => {
        if (status === 200) {
          resolve({ ok: true });
          return;
        }
        // 410 (Gone) veya BadDeviceToken: cihaz kaydı artık geçersiz.
        if (status === 410 || body.includes('BadDeviceToken')) {
          void this.onInvalidToken?.(message.token).catch(() => undefined);
        }
        this.logger.warn('APNs bildirimi reddedildi', { status, body });
        resolve({ ok: false });
      });

      request.end(payload);
    });
  }

  /**
   * APNs sağlayıcı jetonu (ES256 imzalı JWT).
   * Apple en fazla saatte bir yenilemeyi önerir; jeton önbelleklenir.
   */
  private providerToken(): string {
    const now = Date.now();
    if (this.cachedToken && now - this.cachedToken.createdAt < TOKEN_TTL_MS) {
      return this.cachedToken.value;
    }

    const header = base64Url(JSON.stringify({ alg: 'ES256', kid: this.config.keyId }));
    const claims = base64Url(
      JSON.stringify({ iss: this.config.teamId, iat: Math.floor(now / 1000) }),
    );
    const signingInput = `${header}.${claims}`;

    const signature = crypto
      .createSign('SHA256')
      .update(signingInput)
      .sign({ key: this.config.key, dsaEncoding: 'ieee-p1363' });

    const value = `${signingInput}.${base64Url(signature)}`;
    this.cachedToken = { value, createdAt: now };
    return value;
  }
}

/** base64url — JWT bölümleri için (padding'siz, URL güvenli). */
const base64Url = (input: string | Buffer): string =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
