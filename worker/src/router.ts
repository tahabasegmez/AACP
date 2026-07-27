import { HttpError } from './errors';
import { list, type Env } from './env';

/** Handler'a verilen istek bağlamı. */
export interface Ctx {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  readonly params: Record<string, string>;
  readonly headers: Headers;
  /** Çözülmüş JSON gövde (yoksa undefined). */
  readonly body: unknown;
  readonly env: Env;
  /** Yanıt döndükten sonra çalışacak işler (telemetri, bildirim). */
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

export type Handler = (ctx: Ctx) => Promise<Response> | Response;

interface Route {
  readonly method: string;
  readonly segments: readonly string[];
  readonly handler: Handler;
}

/** Gövde sınırı — telemetri toplu gönderimi için fazlasıyla yeterli. */
const MAX_BODY_BYTES = 1024 * 1024;

/**
 * Router — Workers `Request`/`Response` üzerine kurulu küçük yönlendirici.
 *
 * Çerçeve (Hono/itty) yerine ~120 satırlık kendi router'ımız kullanılır:
 * ihtiyaç yüzeyi dar (birkaç REST ucu), bağımlılık eklemek bundle'ı ve bakım
 * yükünü gereksiz büyütürdü.
 *
 * Yol desenleri `:param` destekler, ör. `/v1/sync/:collection`.
 */
export class Router {
  private readonly routes: Route[] = [];

  get(path: string, handler: Handler): this {
    return this.add('GET', path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add('POST', path, handler);
  }

  private add(method: string, path: string, handler: Handler): this {
    this.routes.push({ method, segments: split(path), handler });
    return this;
  }

  /** İsteği karşılar; hata olursa tek tip JSON hata yanıtı döner. */
  async handle(request: Request, env: Env, waitUntil: Ctx['waitUntil']): Promise<Response> {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(env, origin);

    // CORS ön kontrolü.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const url = new URL(request.url);
      const segments = split(url.pathname);
      const match = this.match(request.method.toUpperCase(), segments);
      if (!match) {
        throw HttpError.notFound(`Uç bulunamadı — ${url.pathname}`);
      }

      const response = await match.route.handler({
        method: request.method.toUpperCase(),
        path: url.pathname,
        query: url.searchParams,
        params: match.params,
        headers: request.headers,
        body: await readJson(request),
        env,
        waitUntil,
      });

      // CORS başlıkları her yanıta eklenir.
      const headers = new Headers(response.headers);
      Object.entries(cors).forEach(([key, value]) => headers.set(key, value));
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      const failure =
        error instanceof HttpError
          ? error
          : HttpError.internal(error instanceof Error ? error.message : 'Bilinmeyen hata');

      return json(
        { error: { code: failure.code, message: failure.message } },
        failure.status,
        cors,
      );
    }
  }

  private match(
    method: string,
    segments: readonly string[],
  ): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method || route.segments.length !== segments.length) {
        continue;
      }
      const params: Record<string, string> = {};
      let matched = true;
      for (let i = 0; i < route.segments.length; i++) {
        const pattern = route.segments[i];
        if (pattern.startsWith(':')) {
          params[pattern.slice(1)] = decodeURIComponent(segments[i]);
        } else if (pattern !== segments[i]) {
          matched = false;
          break;
        }
      }
      if (matched) {
        return { route, params };
      }
    }
    return null;
  }
}

const split = (path: string): string[] => path.split('/').filter(s => s.length > 0);

/** JSON gövdeyi sınırlı boyutta okur. */
const readJson = async (request: Request): Promise<unknown> => {
  if (request.method === 'GET' || request.method === 'DELETE') {
    return undefined;
  }
  const text = await request.text();
  if (!text.trim()) {
    return undefined;
  }
  if (text.length > MAX_BODY_BYTES) {
    throw HttpError.badRequest('Gövde çok büyük');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw HttpError.badRequest('Gövde geçerli JSON değil');
  }
};

/**
 * CORS başlıkları.
 *
 * Native istemciler CORS'a tabi değildir; bu yalnızca ileride bir web arayüzü
 * eklenirse gerekir. Kaynak listesi boşsa CORS kapalıdır (en dar varsayılan).
 */
const corsHeaders = (env: Env, origin: string | null): Record<string, string> => {
  const allowed = list(env.CORS_ORIGINS);
  if (!origin || allowed.length === 0 || !allowed.includes(origin)) {
    return {};
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,x-admin-token',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

/** JSON yanıt yardımcıları. */
export const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  });

export const ok = (body: unknown): Response => json(body, 200);
export const created = (body: unknown): Response => json(body, 201);
export const noContent = (): Response => new Response(null, { status: 204 });
