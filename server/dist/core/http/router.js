"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Router = void 0;
const errors_1 = require("../errors");
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
class Router {
    logger;
    routes = [];
    middlewares = [];
    constructor(logger) {
        this.logger = logger;
    }
    use(mw) {
        this.middlewares.push(mw);
        return this;
    }
    get(path, handler) {
        return this.add('GET', path, handler);
    }
    post(path, handler) {
        return this.add('POST', path, handler);
    }
    put(path, handler) {
        return this.add('PUT', path, handler);
    }
    delete(path, handler) {
        return this.add('DELETE', path, handler);
    }
    add(method, path, handler) {
        this.routes.push({ method, segments: splitPath(path), handler });
        return this;
    }
    /** Node http sunucusuna verilecek istek dinleyicisi. */
    handler = async (req, res) => {
        const started = Date.now();
        let status = 500;
        try {
            const result = await this.dispatch(req, res);
            status = result.status;
            send(res, result);
        }
        catch (error) {
            const failure = toHttpError(error);
            status = failure.status;
            if (failure.status >= 500) {
                this.logger.error('İstek başarısız', { path: req.url, error: String(error) });
            }
            send(res, {
                status: failure.status,
                body: { error: { code: failure.code, message: failure.message } },
            });
        }
        finally {
            this.logger.info('request', {
                method: req.method,
                path: req.url,
                status,
                ms: Date.now() - started,
            });
        }
    };
    /** İsteği çözer, ara katmanları uygular ve eşleşen handler'ı çalıştırır. */
    async dispatch(req, res) {
        const method = (req.method ?? 'GET').toUpperCase();
        const url = new URL(req.url ?? '/', 'http://localhost');
        const segments = splitPath(url.pathname);
        // CORS ön kontrolü — gerçek başlıklar `cors` ara katmanında eklenir.
        if (method === 'OPTIONS') {
            return { status: 204 };
        }
        const match = this.match(method, segments);
        if (!match) {
            throw errors_1.HttpError.notFound(`Uç bulunamadı — ${url.pathname}`);
        }
        let ctx = {
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
    match(method, segments) {
        for (const route of this.routes) {
            if (route.method !== method || route.segments.length !== segments.length) {
                continue;
            }
            const params = {};
            let matched = true;
            for (let i = 0; i < route.segments.length; i++) {
                const pattern = route.segments[i];
                if (pattern.startsWith(':')) {
                    params[pattern.slice(1)] = decodeURIComponent(segments[i]);
                }
                else if (pattern !== segments[i]) {
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
exports.Router = Router;
const splitPath = (path) => path.split('/').filter(segment => segment.length > 0);
/** İstemci IP'si — ters proxy arkasındaysa X-Forwarded-For dikkate alınır. */
const clientIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket.remoteAddress ?? 'unknown';
};
/** Gövdeyi sınırlı boyutta okur ve JSON'a çözer; gövde yoksa undefined. */
const readJsonBody = (req) => new Promise((resolve, reject) => {
    if (req.method === 'GET' || req.method === 'DELETE') {
        resolve(undefined);
        return;
    }
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY_BYTES) {
            reject(errors_1.HttpError.badRequest('Gövde çok büyük'));
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
        }
        catch {
            reject(errors_1.HttpError.badRequest('Gövde geçerli JSON değil'));
        }
    });
    req.on('error', reject);
});
const toHttpError = (error) => {
    if (error instanceof errors_1.HttpError) {
        return error;
    }
    return errors_1.HttpError.internal(error instanceof Error ? error.message : 'Bilinmeyen hata');
};
/** Sonucu JSON olarak yazar (gövde yoksa boş yanıt). */
const send = (res, result) => {
    const headers = { ...(result.headers ?? {}) };
    let payload;
    if (result.body !== undefined) {
        payload = typeof result.body === 'string' ? result.body : JSON.stringify(result.body);
        headers['Content-Type'] = headers['Content-Type'] ?? 'application/json; charset=utf-8';
        headers['Content-Length'] = String(Buffer.byteLength(payload));
    }
    res.writeHead(result.status, headers);
    res.end(payload);
};
//# sourceMappingURL=router.js.map