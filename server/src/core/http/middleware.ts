import { HttpError } from '../errors';
import type { Middleware } from './router';
import type { RequestContext } from './types';

/**
 * CORS — yalnızca yapılandırılmış kökenlere izin verir.
 * Mobil istemci CORS'a tabi değildir; bu ayar ileride bir web paneli/istemci
 * eklenirse gerekir. Liste boşsa hiçbir başlık gönderilmez (en kısıtlı hâl).
 */
export const cors = (origins: readonly string[]): Middleware => ctx => {
  if (origins.length === 0) {
    return ctx;
  }
  const requestOrigin = ctx.headers.origin;
  const origin = Array.isArray(requestOrigin) ? requestOrigin[0] : requestOrigin;
  const allowed = origins.includes('*') ? '*' : origin && origins.includes(origin) ? origin : undefined;

  if (allowed) {
    ctx.raw.res.setHeader('Access-Control-Allow-Origin', allowed);
    ctx.raw.res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    ctx.raw.res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }
  return ctx;
};

/**
 * Basit sabit-pencere oran sınırlayıcı (IP başına dakikada N istek).
 *
 * Bellek-içi tutulur: tek örnekli dağıtım için yeterlidir. Birden çok örnek
 * çalıştırılacaksa ters proxy (nginx/Traefik) ya da paylaşımlı bir sayaç
 * (Redis) tercih edilmelidir.
 */
export const rateLimit = (perMinute: number): Middleware => {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (ctx: RequestContext) => {
    const now = Date.now();
    const entry = hits.get(ctx.ip);

    if (!entry || entry.resetAt <= now) {
      hits.set(ctx.ip, { count: 1, resetAt: now + 60_000 });
    } else if (entry.count >= perMinute) {
      throw HttpError.tooManyRequests();
    } else {
      entry.count++;
    }

    // Sızıntıyı önlemek için süresi geçmiş kayıtları ara sıra temizle.
    if (hits.size > 10_000) {
      for (const [ip, e] of hits) {
        if (e.resetAt <= now) {
          hits.delete(ip);
        }
      }
    }
    return ctx;
  };
};

/**
 * Jeton varsa kullanıcıyı çözer (zorunlu değil). Kimlik gerektiren uçlar
 * `AuthService.requireUserId` ile ayrıca kontrol eder.
 */
export const authenticate =
  (resolve: (header: string | string[] | undefined) => string | undefined): Middleware =>
  ctx => {
    try {
      const userId = resolve(ctx.headers.authorization);
      return userId ? { ...ctx, userId } : ctx;
    } catch {
      // Geçersiz jeton anonim sayılır; korumalı uçlar yine 401 döndürür.
      return ctx;
    }
  };
