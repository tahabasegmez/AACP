import crypto from 'node:crypto';
import { HttpError } from '../../core/errors';

/**
 * Jeton üretimi/doğrulaması — HMAC imzalı, kendi kendini doğrulayan jetonlar.
 *
 * Biçim: base64url(payload).base64url(hmacSHA256(payload, secret))
 *
 * Neden hazır bir JWT kütüphanesi değil: ihtiyacımız tek bir claim (userId) ve
 * son kullanma zamanı; kendi imzamızı doğrulamak birkaç satır ve sıfır
 * bağımlılık. Standart JWT gerekirse bu dosya değişir, çağıranlar değişmez.
 */

interface TokenPayload {
  readonly sub: string;
  /** Son geçerlilik (epoch saniye). */
  readonly exp: number;
}

const b64u = (input: Buffer | string): string =>
  Buffer.from(input).toString('base64url');

const sign = (payload: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(payload).digest('base64url');

export const createToken = (userId: string, secret: string, ttlSec: number): string => {
  const payload: TokenPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  };
  const encoded = b64u(JSON.stringify(payload));
  return `${encoded}.${sign(encoded, secret)}`;
};

/**
 * Jetonu doğrular ve kullanıcı kimliğini döner.
 * İmza geçersiz veya süresi dolmuşsa 401 fırlatır.
 */
export const verifyToken = (token: string, secret: string): string => {
  const [encoded, signature] = token.split('.');
  if (!encoded || !signature) {
    throw HttpError.unauthorized('Jeton biçimi geçersiz');
  }

  const expected = sign(encoded, secret);
  // Zamanlama saldırılarına karşı sabit süreli karşılaştırma.
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw HttpError.unauthorized('Jeton imzası geçersiz');
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as TokenPayload;
  } catch {
    throw HttpError.unauthorized('Jeton içeriği okunamadı');
  }

  if (!payload.sub || typeof payload.exp !== 'number') {
    throw HttpError.unauthorized('Jeton eksik alan içeriyor');
  }
  if (payload.exp * 1000 < Date.now()) {
    throw HttpError.unauthorized('Jetonun süresi doldu');
  }
  return payload.sub;
};
