import { describe, expect, it } from 'vitest';
import { bearerToken, verifyToken } from '../auth';

const SECRET = 'test-jwt-secret-en-az-32-karakter-olmali';

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
  it('geçerli jetonu çözer', async () => {
    const token = await makeToken({ sub: 'user-1', email: 'a@b.com', exp: future() });
    const claims = await verifyToken(token, SECRET);

    expect(claims.sub).toBe('user-1');
    expect(claims.email).toBe('a@b.com');
  });

  it('BAŞKA anahtarla imzalanmış jetonu reddeder', async () => {
    const token = await makeToken({ sub: 'user-1', exp: future() }, 'baska-gizli-anahtar');
    await expect(verifyToken(token, SECRET)).rejects.toThrow(/imza/i);
  });

  it('süresi dolmuş jetonu reddeder', async () => {
    const token = await makeToken({ sub: 'user-1', exp: past() });
    await expect(verifyToken(token, SECRET)).rejects.toThrow(/süre/i);
  });

  it('kullanıcısız jetonu reddeder', async () => {
    const token = await makeToken({ exp: future() });
    await expect(verifyToken(token, SECRET)).rejects.toThrow();
  });

  it('bozuk biçimi reddeder', async () => {
    await expect(verifyToken('bozuk-jeton', SECRET)).rejects.toThrow(/biçim/i);
  });

  it('yükü kurcalanmış jetonu reddeder', async () => {
    const token = await makeToken({ sub: 'user-1', exp: future() });
    const [header, , signature] = token.split('.');
    // Başkasının kimliğine bürünme denemesi.
    const forged = btoa(JSON.stringify({ sub: 'user-2', exp: future() }))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    await expect(verifyToken(`${header}.${forged}.${signature}`, SECRET)).rejects.toThrow();
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
