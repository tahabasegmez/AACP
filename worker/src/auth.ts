import type { Env } from './env';
import { HttpError } from './errors';
import type { Ctx } from './router';

/** Supabase JWT'sinin bizi ilgilendiren alanları. */
interface JwtClaims {
  readonly sub?: string;
  readonly exp?: number;
  readonly email?: string;
  readonly role?: string;
}

/** JWT başlığı — imza algoritmasını ve anahtar kimliğini taşır. */
interface JwtHeader {
  readonly alg?: string;
  readonly kid?: string;
}

/** JWKS'ten gelen açık anahtar. */
interface Jwk {
  readonly kid?: string;
  readonly kty?: string;
  readonly crv?: string;
  readonly alg?: string;
}

/**
 * JWKS önbelleği.
 *
 * Worker örneği istekler arasında yaşadığı için anahtarlar bir kez çekilip
 * saklanır; her istekte JWKS indirmek edge'in hız avantajını yok ederdi.
 * Anahtar rotasyonunu kaçırmamak için TTL uygulanır, ayrıca bilinmeyen bir
 * `kid` görülürse önbellek anında tazelenir.
 */
let jwksCache: { keys: Jwk[]; fetchedAt: number } | undefined;
const JWKS_TTL_MS = 10 * 60_000;

const fetchJwks = async (supabaseUrl: string, force = false): Promise<Jwk[]> => {
  const now = Date.now();
  if (!force && jwksCache && now - jwksCache.fetchedAt < JWKS_TTL_MS) {
    return jwksCache.keys;
  }
  const response = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/auth/v1/.well-known/jwks.json`);
  if (!response.ok) {
    throw HttpError.internal(`JWKS alınamadı (${response.status})`);
  }
  const body = (await response.json()) as { keys?: Jwk[] };
  const keys = body.keys ?? [];
  jwksCache = { keys, fetchedAt: now };
  return keys;
};

/** `kid` ile eşleşen anahtarı bulur; yoksa JWKS'i bir kez tazeleyip tekrar arar. */
const findKey = async (supabaseUrl: string, kid?: string): Promise<Jwk> => {
  const pick = (keys: Jwk[]): Jwk | undefined =>
    kid ? keys.find(k => k.kid === kid) : keys[0];

  const cached = pick(await fetchJwks(supabaseUrl));
  if (cached) {
    return cached;
  }
  // Anahtar döndürülmüş olabilir — önbelleği zorla tazele.
  const fresh = pick(await fetchJwks(supabaseUrl, true));
  if (!fresh) {
    throw HttpError.unauthorized('Jetonu doğrulayacak anahtar bulunamadı');
  }
  return fresh;
};

/** Doğrulanmış oturum bilgisi. */
export interface Session {
  readonly userId: string;
  readonly email?: string;
  /** Ham jeton — Supabase'e RLS altında istek atmak için gerekir. */
  readonly accessToken: string;
}

/**
 * Supabase erişim jetonunu YERELDE doğrular.
 *
 * Her istekte Supabase'e "bu jeton geçerli mi" diye sormak edge'in hız
 * avantajını yok ederdi; imza doğrulaması Web Crypto ile birkaç mikrosaniye
 * sürer.
 *
 * İKİ İMZA TÜRÜ desteklenir çünkü Supabase projeleri ikisini de kullanabilir:
 *  - **ES256/RS256 (asimetrik)** — yeni projelerin varsayılanı. Açık anahtar
 *    projenin JWKS ucundan alınır; gizli anahtar hiçbir zaman bizde bulunmaz.
 *    Bu daha güvenlidir: Worker sızsa bile jeton ÜRETİLEMEZ, yalnızca
 *    doğrulanabilir.
 *  - **HS256 (simetrik)** — eski projeler. `SUPABASE_JWT_SECRET` gerekir.
 *
 * Hangisinin kullanılacağı jetonun başlığındaki `alg` alanından anlaşılır.
 */
export const verifyToken = async (token: string, env: Env): Promise<JwtClaims> => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw HttpError.unauthorized('Jeton biçimi geçersiz');
  }
  const [headerPart, payloadPart, signaturePart] = parts;

  const header = JSON.parse(
    new TextDecoder().decode(base64UrlToBytes(headerPart)),
  ) as JwtHeader;
  const signature = base64UrlToBytes(signaturePart);
  const signed = new TextEncoder().encode(`${headerPart}.${payloadPart}`);

  const valid =
    header.alg === 'HS256'
      ? await verifyHmac(signed, signature, env.SUPABASE_JWT_SECRET)
      : await verifyAsymmetric(signed, signature, header, env.SUPABASE_URL);

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

/** HS256 — paylaşılan gizli anahtarla imza doğrulaması (eski projeler). */
const verifyHmac = async (
  signed: Uint8Array,
  signature: Uint8Array,
  secret?: string,
): Promise<boolean> => {
  if (!secret) {
    throw HttpError.internal('SUPABASE_JWT_SECRET tanımlı değil (HS256 jetonu için gerekli)');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  return crypto.subtle.verify('HMAC', key, signature, signed);
};

/** ES256/RS256 — JWKS'ten alınan AÇIK anahtarla imza doğrulaması. */
const verifyAsymmetric = async (
  signed: Uint8Array,
  signature: Uint8Array,
  header: JwtHeader,
  supabaseUrl: string,
): Promise<boolean> => {
  const jwk = await findKey(supabaseUrl, header.kid);

  // Anahtar türüne göre algoritma parametreleri.
  const isEc = (jwk.kty ?? '') === 'EC';
  const algorithm = isEc
    ? { name: 'ECDSA', namedCurve: jwk.crv ?? 'P-256' }
    : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' };
  const verifyParams = isEc ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' };

  const key = await crypto.subtle.importKey(
    'jwk',
    // `key_ops`/`use` alanları içe aktarmayı reddettirebilir; yalnızca
    // doğrulama için gerekli alanlar bırakılır.
    { ...(jwk as JsonWebKey), key_ops: ['verify'], ext: true },
    algorithm,
    false,
    ['verify'],
  );

  return crypto.subtle.verify(verifyParams, key, signature, signed);
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
  const claims = await verifyToken(token, ctx.env);
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
