import type { IncomingMessage, ServerResponse } from 'node:http';
import { HttpError } from '../errors';
import type { Logger } from '../logger';
import type { Handler, HttpResult, RequestContext } from './types';

/** Bir rota kaydı: yöntem + yol deseni + handler. */
interface Route {
  readonly method: string;
  readonly segments: readonly string[];
  readonly handler: Handler;
}

/** İstek işlemeden önce çalışan ara katman (auth, rate limit...). */
export type Middleware = (ctx: RequestContext) => Promise<RequestContext> | RequestContext;

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB — telemetri toplu gönderimi için yeterli

/**
 * Router — bağımlılıksız, küçük bir HTTP yönlendirici.
 *
 * Express yerine Node'un yerleşik http modülü kullanılır: daha az bağımlılık,
 * ARM/x86 fark etmeksizin sorunsuz kurulum. İhtiyacımız olan yüzey küçük
 * (birkaç REST ucu), bu yüzden çerçeve maliyeti gereksiz olurdu.
 *
 * Yol desenleri `:param` destekler, ör. `/v1/sync/:collection`.
 */
export class Router {
  private readonly routes: Route[] = [];
  private readonly middlewares: Middleware[] = [];

  constructor(private readonly logger: Logger) {}

  use(mw: Middleware): this {
    this.middlewares.push(mw);
    return this;
  }

  get(path: string, handler: Handler): this {
    return this.add('GET', path, handler);
  }

  post(path: string, handler: Handler): this {
    return this.add('POST', path, handler);
  }

  put(path: string, handler: Handler): this {
    return this.add('PUT', path, handler);
  }

  delete(path: string, handler: Handler): this {
    return this.add('DELETE', path, handler);
  }

  private add(method: string, path: string, handler: Handler): this {
    this.routes.push({ method, segments: splitPath(path), handler });
    return this;
  }

  /** Node http sunucusuna verilecek istek dinleyicisi. */
  handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const started = Date.now();
    let status = 500;
    try {
      const result = await this.dispatch(req, res);
      status = result.status;
      send(res, result);
    } catch (error) {
      const failure = toHttpError(error);
      status = failure.status;
      if (failure.status >= 500) {
        this.logger.error('İstek başarısız', { path: req.url, error: String(error) });
      }
      send(res, {
        status: failure.status,
        body: { error: { code: failure.code, message: failure.message } },
      });
    } finally {
      this.logger.info('request', {
        method: req.method,
        path: req.url,
        status,
        ms: Date.now() - started,
      });
    }
  };

  /** İsteği çözer, ara katmanları uygular ve eşleşen handler'ı çalıştırır. */
  private async dispatch(req: IncomingMessage, res: ServerResponse): Promise<HttpResult> {
    const method = (req.method ?? 'GET').toUpperCase();
    const url = new URL(req.url ?? '/', 'http://localhost');
    const segments = splitPath(url.pathname);

    // CORS ön kontrolü — gerçek başlıklar `cors` ara katmanında eklenir.
    if (method === 'OPTIONS') {
      return { status: 204 };
    }

    const match = this.match(method, segments);
    if (!match) {
      throw HttpError.notFound(`Uç bulunamadı — ${url.pathname}`);
    }

    let ctx: RequestContext = {
      method,
      path: url.pathname,
      query: url.searchParams,
      params: match.params,
      headers: req.headers,
      body: await readJsonBody(req),
      ip: clientIp(req),
      raw: { req, res },
    };

    for (const mw of this.middlewares) {
      ctx = await mw(ctx);
    }

    return match.route.handler(ctx);
  }

  /** Yol desenini istek yoluyla eşleştirir ve parametreleri çıkarır. */
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

const splitPath = (path: string): string[] =>
  path.split('/').filter(segment => segment.length > 0);

/** İstemci IP'si — ters proxy arkasındaysa X-Forwarded-For dikkate alınır. */
const clientIp = (req: IncomingMessage): string => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress ?? 'unknown';
};

/** Gövdeyi sınırlı boyutta okur ve JSON'a çözer; gövde yoksa undefined. */
const readJsonBody = (req: IncomingMessage): Promise<unknown> =>
  new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
      resolve(undefined);
      return;
    }
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(HttpError.badRequest('Gövde çok büyük'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      const text = Buffer.concat(chunks).toString('utf8').trim();
      if (!text) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(HttpError.badRequest('Gövde geçerli JSON değil'));
      }
    });
    req.on('error', reject);
  });

const toHttpError = (error: unknown): HttpError => {
  if (error instanceof HttpError) {
    return error;
  }
  return HttpError.internal(error instanceof Error ? error.message : 'Bilinmeyen hata');
};

/** Sonucu JSON olarak yazar (gövde yoksa boş yanıt). */
const send = (res: ServerResponse, result: HttpResult): void => {
  const headers: Record<string, string> = { ...(result.headers ?? {}) };
  let payload: string | undefined;

  if (result.body !== undefined) {
    payload = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
    headers['Content-Type'] = headers['Content-Type'] ?? 'application/json; charset=utf-8';
    headers['Content-Length'] = String(Buffer.byteLength(payload));
  }

  res.writeHead(result.status, headers);
  res.end(payload);
};
