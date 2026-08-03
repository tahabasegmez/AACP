import { afterEach, describe, expect, it, vi } from 'vitest';
import { conditionalHeaders, fetchFeed, readValidators } from '../push/FeedFetcher';
import { summarize } from '../push/FeedWatcher';

const response = (
  status: number,
  body = '',
  headers: Record<string, string> = {},
): Response => new Response(status === 304 ? null : body, { status, headers });

afterEach(() => vi.unstubAllGlobals());

describe('conditionalHeaders', () => {
  it('doğrulayıcı yoksa yalnızca Accept gönderir', () => {
    expect(conditionalHeaders({})).toEqual({
      Accept: 'application/rss+xml, application/xml, text/xml',
    });
  });

  it('İKİ doğrulayıcıyı da gönderir', () => {
    // Yayıncıların bir kısmı yalnızca birini destekler; ikisini de göndermek
    // en geniş uyumu verir.
    const headers = conditionalHeaders({ etag: 'W/"a1"', lastModified: 'Mon, 20 Jul 2026' });

    expect(headers['If-None-Match']).toBe('W/"a1"');
    expect(headers['If-Modified-Since']).toBe('Mon, 20 Jul 2026');
  });
});

describe('readValidators', () => {
  it('yanıt başlıklarından okur', () => {
    const headers = new Headers({ etag: 'W/"x"', 'last-modified': 'Tue, 21 Jul 2026' });

    expect(readValidators(headers)).toEqual({
      etag: 'W/"x"',
      lastModified: 'Tue, 21 Jul 2026',
    });
  });
});

describe('fetchFeed', () => {
  it('304 gelirse DEĞİŞMEMİŞ döner ve gövde okumaz', async () => {
    // Asıl kazanç burada: indirme, ayrıştırma ve yazma adımlarının tamamı atlanır.
    vi.stubGlobal('fetch', vi.fn(async () => response(304)));

    expect(await fetchFeed('https://feed', { etag: 'a' })).toEqual({ status: 'unchanged' });
  });

  it('200 gelirse gövdeyi ve yeni doğrulayıcıları döner', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => response(200, '<rss/>', { etag: 'W/"yeni"' })),
    );

    const result = await fetchFeed('https://feed', {});

    expect(result).toEqual({
      status: 'ok',
      xml: '<rss/>',
      validators: { etag: 'W/"yeni"', lastModified: undefined },
    });
  });

  it('yayıncı doğrulayıcı vermezse ESKİSİNİ korur', async () => {
    // Elimizdekini atmak, bir sonraki turu gereksiz yere koşulsuz yapardı.
    vi.stubGlobal('fetch', vi.fn(async () => response(200, '<rss/>')));

    const result = await fetchFeed('https://feed', { etag: 'eski' });

    expect(result.status === 'ok' && result.validators.etag).toBe('eski');
  });

  it('koşullu başlıkları isteğe ekler', async () => {
    const spy = vi.fn(async (_url: string, _init?: { headers?: Record<string, string> }) =>
      response(304),
    );
    vi.stubGlobal('fetch', spy);

    await fetchFeed('https://feed', { etag: 'W/"a1"' });

    expect(spy.mock.calls[0][1]?.headers?.['If-None-Match']).toBe('W/"a1"');
  });

  it('hata durum kodunu başarısızlık sayar', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response(500)));

    expect(await fetchFeed('https://feed', {})).toEqual({
      status: 'failed',
      reason: 'HTTP 500',
    });
  });

  it('ağ hatasını yutup başarısızlık döner', async () => {
    // Tek yayıncının çökmesi turu düşürmemeli.
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('koptu'); }));

    const result = await fetchFeed('https://feed', {});
    expect(result).toEqual({ status: 'failed', reason: 'koptu' });
  });
});

describe('summarize', () => {
  it('tekil sonuçları toplar', () => {
    const summary = summarize(
      [
        { slug: 'a', unchanged: true, ingested: 0, notified: 0 },
        { slug: 'b', unchanged: false, ingested: 12, notified: 3 },
        { slug: 'c', unchanged: false, ingested: 0, notified: 0, failed: 'HTTP 404' },
      ],
      'inline',
    );

    expect(summary).toEqual({
      checked: 3,
      unchanged: 1,
      ingested: 12,
      notified: 3,
      failed: 1,
      mode: 'inline',
    });
  });
});
