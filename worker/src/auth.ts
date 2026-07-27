import { HttpError } from './errors';
import type { Ctx } from './router';

/** Supabase JWT'sinin bizi ilgilendiren alanları. */
interface JwtClaims {
  readonly sub?: string;
  readonly exp?: number;
  readonly email?: string;
  readonly role?: string;
}

/** Doğrulanmış oturum bilgisi. */
export interface Session {
  readonly userId: string;
  readonly email?: string;
  /** Ham jeton — Supabase'e RLS altında istek atmak için gerekir. */
  readonly accessToken: string;
}

/**
 * Supabase erişim jetonunu YERELDE doğrular (HS256 + JWT secret).
 *
 * Her istekte Supabase'e "bu jeton geçerli mi" diye sormak edge'in hız
 * avantajını yok ederdi; imza doğrulaması Web Crypto ile birkaç mikrosaniye
 * sürer. Jetonun süresi ayrıca kontrol edilir.
 *
 * Not: Supabase asimetrik anahtarlara (RS256/ES256) geçilirse burası JWKS
 * doğrulamasıyla değiştirilmelidir — çağıran kod etkilenmez.
 */
export const verifyToken = async (token: string, secret: string): Promise<JwtClaims> => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw HttpError.unauthorized('Jeton biçimi geçersiz');
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );

  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    base64UrlToBytes(signaturePart),
    new TextEncoder().encode(`${headerPart}.${payloadPart}`),
  );
  if (!valid) {
    throw HttpError.unauthorized('Jeton imzası geçersiz');
  }

  const claims = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payloadPart))) as JwtClaims;

  if (claims.exp && claims.exp * 1000 < Date.now()) {
    throw HttpError.unauthorized('Oturum süresi doldu');
  }
  if (!claims.sub) {
    throw HttpError.unauthorized('Jetonda kullanıcı yok');
  }
  return claims;
};

/** `Authorization: Bearer <token>` başlığından jetonu çıkarır. */
export const bearerToken = (headers: Headers): string | undefined => {
  const value = headers.get('authorization');
  if (!value?.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }
  const token = value.slice(7).trim();
  return token.length > 0 ? token : undefined;
};

/** Kimlik zorunlu uçlar için: oturum yoksa 401. */
export const requireSession = async (ctx: Ctx): Promise<Session> => {
  const token = bearerToken(ctx.headers);
  if (!token) {
    throw HttpError.unauthorized('Bu uç için oturum gerekli');
  }
  const claims = await verifyToken(token, ctx.env.SUPABASE_JWT_SECRET);
  return { userId: claims.sub!, email: claims.email, accessToken: token };
};

/** Oturum varsa döner, yoksa undefined (zorunlu olmayan uçlar için). */
export const optionalSession = async (ctx: Ctx): Promise<Session | undefined> => {
  try {
    return await requireSession(ctx);
  } catch {
    return undefined;
  }
};

/**
 * Yönetim uçlarını korur. `ADMIN_TOKEN` tanımlı değilse uç KAPALIDIR —
 * yanlışlıkla korumasız bırakmaktansa erişilemez olması güvenlidir.
 */
export const requireAdmin = (ctx: Ctx): void => {
  const expected = ctx.env.ADMIN_TOKEN;
  if (!expected) {
    throw HttpError.forbidden('Yönetim uçları kapalı (ADMIN_TOKEN tanımlı değil)');
  }
  const provided = ctx.headers.get('x-admin-token') ?? '';
  if (!timingSafeEqual(provided, expected)) {
    throw HttpError.forbidden('Yönetim anahtarı geçersiz');
  }
};

/** Sabit zamanlı karşılaştırma — anahtar tahminini zorlaştırır. */
const timingSafeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

/** base64url → bayt dizisi. */
const base64UrlToBytes = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};
