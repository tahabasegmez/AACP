import { describe, expect, it } from 'vitest';
import { bearerToken, verifyToken } from '../auth';
import type { Env } from '../env';

const SECRET = 'test-jwt-secret-en-az-32-karakter-olmali';

/** HS256 doğrulaması için yeterli sahte ortam. */
const envWith = (secret?: string): Env =>
  ({ SUPABASE_JWT_SECRET: secret, SUPABASE_URL: 'https://test.supabase.co' }) as Env;

/** Test için HS256 imzalı bir JWT üretir (Supabase'in ürettiğiyle aynı biçim). */
const makeToken = async (
  claims: Record<string, unknown>,
  secret = SECRET,
): Promise<string> => {
  const encode = (value: unknown): string =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode(claims);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${header}.${payload}`),
  );
  const bytes = new Uint8Array(signature);
  let binary = '';
  bytes.forEach(b => {
    binary += String.fromCharCode(b);
  });
  const sig = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return `${header}.${payload}.${sig}`;
};

const future = () => Math.floor(Date.now() / 1000) + 3600;
const past = () => Math.floor(Date.now() / 1000) - 10;

describe('verifyToken', () => {
  it('geçerli HS256 jetonunu çözer', async () => {
    const token = await makeToken({ sub: 'user-1', email: 'a@b.com', exp: future() });
    const claims = await verifyToken(token, envWith(SECRET));

    expect(claims.sub).toBe('user-1');
    expect(claims.email).toBe('a@b.com');
  });

  it('HS256 jetonu için secret yoksa açık hata verir', async () => {
    const token = await makeToken({ sub: 'user-1', exp: future() });
    await expect(verifyToken(token, envWith(undefined))).rejects.toThrow(
      /SUPABASE_JWT_SECRET/,
    );
  });

  it('ES256 jetonunu JWKS ile doğrular (asimetrik — yeni projeler)', async () => {
    // Gerçek bir ECDSA anahtar çifti üretip Supabase'in JWKS ucunu taklit et.
    const pair = (await crypto.subtle.generateKey(
      { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    )) as CryptoKeyPair;
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);

    const encode = (value: unknown): string =>
      btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const header = encode({ alg: 'ES256', kid: 'anahtar-1', typ: 'JWT' });
    const payload = encode({ sub: 'user-es', exp: future() });

    const signature = await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      pair.privateKey,
      new TextEncoder().encode(`${header}.${payload}`),
    );
    const bytes = new Uint8Array(signature);
    let binary = '';
    bytes.forEach(b => {
      binary += String.fromCharCode(b);
    });
    const sig = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ keys: [{ ...publicJwk, kid: 'anahtar-1' }] }), {
        headers: { 'Content-Type': 'application/json' },
      })) as typeof fetch;

    try {
      const claims = await verifyToken(`${header}.${payload}.${sig}`, envWith());
      expect(claims.sub).toBe('user-es');
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('BAŞKA anahtarla imzalanmış jetonu reddeder', async () => {
    const token = await makeToken({ sub: 'user-1', exp: future() }, 'baska-gizli-anahtar');
    await expect(verifyToken(token, envWith(SECRET))).rejects.toThrow(/imza/i);
  });

  it('süresi dolmuş jetonu reddeder', async () => {
    const token = await makeToken({ sub: 'user-1', exp: past() });
    await expect(verifyToken(token, envWith(SECRET))).rejects.toThrow(/süre/i);
  });

  it('kullanıcısız jetonu reddeder', async () => {
    const token = await makeToken({ exp: future() });
    await expect(verifyToken(token, envWith(SECRET))).rejects.toThrow();
  });

  it('bozuk biçimi reddeder', async () => {
    await expect(verifyToken('bozuk-jeton', envWith(SECRET))).rejects.toThrow(/biçim/i);
  });

  it('yükü kurcalanmış jetonu reddeder', async () => {
    const token = await makeToken({ sub: 'user-1', exp: future() });
    const [header, , signature] = token.split('.');
    // Başkasının kimliğine bürünme denemesi.
    const forged = btoa(JSON.stringify({ sub: 'user-2', exp: future() }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await expect(
      verifyToken(`${header}.${forged}.${signature}`, envWith(SECRET)),
    ).rejects.toThrow();
  });
});

describe('bearerToken', () => {
  it('Bearer başlığından jetonu çıkarır', () => {
    const headers = new Headers({ Authorization: 'Bearer abc.def.ghi' });
    expect(bearerToken(headers)).toBe('abc.def.ghi');
  });

  it('büyük/küçük harf duyarsızdır', () => {
    const headers = new Headers({ Authorization: 'bearer abc' });
    expect(bearerToken(headers)).toBe('abc');
  });

  it('başlık yoksa undefined döner', () => {
    expect(bearerToken(new Headers())).toBeUndefined();
  });

  it('Bearer olmayan şemayı yok sayar', () => {
    const headers = new Headers({ Authorization: 'Basic abc' });
    expect(bearerToken(headers)).toBeUndefined();
  });
});
