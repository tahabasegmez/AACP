import type { Env } from '../env';
import { flag } from '../env';

const HOSTS = {
  production: 'https://api.push.apple.com',
  sandbox: 'https://api.sandbox.push.apple.com',
} as const;

/** Sağlayıcı jetonu en fazla 1 saat geçerlidir; erken yenilenir. */
const TOKEN_TTL_MS = 50 * 60_000;

export interface PushMessage {
  readonly token: string;
  readonly title: string;
  readonly body: string;
  readonly data?: Readonly<Record<string, string>>;
}

/**
 * ApnsSender — Apple Push Notification service'e bildirim gönderir.
 *
 * Node sürümünden farkı: `node:http2` yerine `fetch` kullanır. Workers'ta
 * http2 modülü yoktur ama APNs'in HTTP/2 uç noktası düz bir REST arayüzüdür ve
 * Cloudflare'in fetch'i HTTP/2 ile konuşur — dolayısıyla ek bir şey gerekmez.
 *
 * ES256 imzalı sağlayıcı jetonu Web Crypto ile üretilir; jeton örnek ömrü
 * boyunca önbelleklenir (Apple sık yenilemeyi önermez).
 *
 * Yapılandırma eksikse `enabled` false olur ve gönderim adımı atlanır.
 */
export class ApnsSender {
  private cachedToken?: { value: string; createdAt: number };

  constructor(private readonly env: Env) {}

  get enabled(): boolean {
    return Boolean(
      this.env.APNS_KEY && this.env.APNS_KEY_ID && this.env.APNS_TEAM_ID && this.env.APNS_BUNDLE_ID,
    );
  }

  /**
   * Bildirimleri gönderir.
   * Geçersiz jetonlar (410 / BadDeviceToken) `invalidTokens` içinde döner ki
   * çağıran kayıtları temizleyebilsin.
   */
  async send(
    messages: readonly PushMessage[],
  ): Promise<{ sent: number; failed: number; invalidTokens: string[] }> {
    if (!this.enabled || messages.length === 0) {
      return { sent: 0, failed: 0, invalidTokens: [] };
    }

    const host = flag(this.env.APNS_PRODUCTION) ? HOSTS.production : HOSTS.sandbox;
    const jwt = await this.providerToken();

    const results = await Promise.all(
      messages.map(async message => {
        const payload = JSON.stringify({
          aps: { alert: { title: message.title, body: message.body }, sound: 'default' },
          ...message.data,
        });

        try {
          const response = await fetch(`${host}/3/device/${message.token}`, {
            method: 'POST',
            headers: {
              authorization: `bearer ${jwt}`,
              'apns-topic': this.env.APNS_BUNDLE_ID!,
              'apns-push-type': 'alert',
              'content-type': 'application/json',
            },
            body: payload,
          });

          if (response.ok) {
            return { ok: true as const };
          }
          const text = await response.text().catch(() => '');
          const invalid = response.status === 410 || text.includes('BadDeviceToken');
          return { ok: false as const, token: invalid ? message.token : undefined };
        } catch {
          return { ok: false as const, token: undefined };
        }
      }),
    );

    return {
      sent: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      invalidTokens: results.map(r => r.token).filter((t): t is string => !!t),
    };
  }

  /** APNs sağlayıcı jetonu (ES256 imzalı JWT). */
  private async providerToken(): Promise<string> {
    const now = Date.now();
    if (this.cachedToken && now - this.cachedToken.createdAt < TOKEN_TTL_MS) {
      return this.cachedToken.value;
    }

    const header = base64Url(JSON.stringify({ alg: 'ES256', kid: this.env.APNS_KEY_ID }));
    const claims = base64Url(
      JSON.stringify({ iss: this.env.APNS_TEAM_ID, iat: Math.floor(now / 1000) }),
    );
    const signingInput = `${header}.${claims}`;

    const key = await crypto.subtle.importKey(
      'pkcs8',
      pemToBytes(this.env.APNS_KEY!),
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign'],
    );
    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(signingInput),
    );

    const value = `${signingInput}.${base64Url(new Uint8Array(signature))}`;
    this.cachedToken = { value, createdAt: now };
    return value;
  }
}

/** PEM (`.p8`) içeriğini ham baytlara çevirir. */
const pemToBytes = (pem: string): Uint8Array => {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/g, '')
    .replace(/-----END [^-]+-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

/** base64url — JWT bölümleri için (padding'siz, URL güvenli). */
const base64Url = (input: string | Uint8Array): string => {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
