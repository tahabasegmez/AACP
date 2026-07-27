import { describe, expect, it } from 'vitest';
import type { Env } from '../env';
import { HttpError } from '../errors';
import { Router, ok } from '../router';

const env = { SUPABASE_URL: '', SUPABASE_ANON_KEY: '' } as unknown as Env;
const noop = () => undefined;

const call = (router: Router, method: string, path: string, body?: unknown) =>
  router.handle(
    new Request(`https://api.test${path}`, {
      method,
      ...(body ? { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } } : {}),
    }),
    env,
    noop,
  );

describe('Router', () => {
  it('eşleşen rotayı çalıştırır', async () => {
    const router = new Router();
    router.get('/health', async () => ok({ status: 'ok' }));

    const response = await call(router, 'GET', '/health');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('yol parametrelerini çözer', async () => {
    const router = new Router();
    router.get('/v1/sync/:collection', async ctx => ok({ collection: ctx.params.collection }));

    const response = await call(router, 'GET', '/v1/sync/progress');
    expect(await response.json()).toEqual({ collection: 'progress' });
  });

  it('sorgu dizesini geçirir', async () => {
    const router = new Router();
    router.get('/v1/sync/:collection', async ctx => ok({ since: ctx.query.get('since') }));

    const response = await call(router, 'GET', '/v1/sync/progress?since=42');
    expect(await response.json()).toEqual({ since: '42' });
  });

  it('JSON gövdeyi çözer', async () => {
    const router = new Router();
    router.post('/echo', async ctx => ok(ctx.body));

    const response = await call(router, 'POST', '/echo', { a: 1 });
    expect(await response.json()).toEqual({ a: 1 });
  });

  it('bilinmeyen yol için 404 döner', async () => {
    const router = new Router();
    const response = await call(router, 'GET', '/yok');

    expect(response.status).toBe(404);
    const body = (await response.json()) as { error: { code: string } };
    expect(body.error.code).toBe('NOT_FOUND');
  });

  it('yöntem eşleşmezse 404 döner', async () => {
    const router = new Router();
    router.get('/health', async () => ok({}));

    expect((await call(router, 'POST', '/health')).status).toBe(404);
  });

  it('HttpError durum kodunu korur', async () => {
    const router = new Router();
    router.get('/gizli', async () => {
      throw HttpError.unauthorized('Oturum gerekli');
    });

    const response = await call(router, 'GET', '/gizli');
    expect(response.status).toBe(401);
    const body = (await response.json()) as { error: { message: string } };
    expect(body.error.message).toBe('Oturum gerekli');
  });

  it('beklenmeyen hatayı 500 olarak sarmalar', async () => {
    const router = new Router();
    router.get('/patla', async () => {
      throw new Error('beklenmedik');
    });

    expect((await call(router, 'GET', '/patla')).status).toBe(500);
  });

  it('geçersiz JSON gövdesini 400 ile reddeder', async () => {
    const router = new Router();
    router.post('/echo', async ctx => ok(ctx.body));

    const response = await router.handle(
      new Request('https://api.test/echo', { method: 'POST', body: '{bozuk' }),
      env,
      noop,
    );
    expect(response.status).toBe(400);
  });

  it('OPTIONS isteğine 204 döner (CORS ön kontrolü)', async () => {
    const router = new Router();
    expect((await call(router, 'OPTIONS', '/health')).status).toBe(204);
  });

  it('CORS listesi boşken kaynak başlığı EKLENMEZ', async () => {
    const router = new Router();
    router.get('/health', async () => ok({}));

    const response = await router.handle(
      new Request('https://api.test/health', { headers: { Origin: 'https://kotu.example' } }),
      env,
      noop,
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('izin verilen kaynağa CORS başlığı ekler', async () => {
    const router = new Router();
    router.get('/health', async () => ok({}));

    const response = await router.handle(
      new Request('https://api.test/health', { headers: { Origin: 'https://iyi.example' } }),
      { ...env, CORS_ORIGINS: 'https://iyi.example' } as unknown as Env,
      noop,
    );
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://iyi.example');
  });
});
