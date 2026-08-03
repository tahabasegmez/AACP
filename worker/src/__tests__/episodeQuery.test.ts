import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  buildEpisodeQuery,
  decodeCursor,
  encodeCursor,
  readQuery,
} from '../catalog/episodeQuery';

const params = (raw: string): URLSearchParams => new URLSearchParams(raw);
const decoded = (query: string): string => decodeURIComponent(query);

describe('imleç', () => {
  it('gidiş dönüş aynı değeri verir', () => {
    const cursor = { publishedSort: '2026-07-31T15:43:00Z', guid: 'ep-1' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('imleç yoksa undefined döner', () => {
    expect(decodeCursor(null)).toBeUndefined();
  });

  it('BOŞLUK içeren guid bozulmaz', () => {
    // Ayraç yalnızca ilk boşluktur; tümünden bölmek guid'i keserdi.
    const cursor = { publishedSort: '2026-07-31T15:43:00Z', guid: 'bölüm 12 (final)' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('Latin-1 dışı guid bozulmaz', () => {
    // `btoa` doğrudan verildiğinde hata fırlatır ve o şovun sayfalaması
    // tümüyle çalışmaz olurdu.
    const cursor = { publishedSort: '2026-07-31T15:43:00Z', guid: 'şov/çğü-İ' };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('bozuk imleci REDDEDER', () => {
    // Sessizce başa dönmek, kullanıcının sayfayı baştan görmesi demekti.
    expect(() => decodeCursor('!!!bozuk')).toThrow(/imleç/i);
  });
});

describe('readQuery', () => {
  it('varsayılanları uygular', () => {
    const query = readQuery('bir-bakista', params(''));
    expect(query).toEqual({
      slug: 'bir-bakista',
      limit: DEFAULT_LIMIT,
      sort: 'newest',
      search: undefined,
      cursor: undefined,
    });
  });

  it('sayfa boyutunu tavana sıkıştırır', () => {
    // İstemcinin istediği kadar satır vermek, tek istekle tabloyu boşaltmaktı.
    expect(readQuery('x', params('limit=5000')).limit).toBe(MAX_LIMIT);
  });

  it('geçersiz sayfa boyutunu varsayılana çeker', () => {
    expect(readQuery('x', params('limit=abc')).limit).toBe(DEFAULT_LIMIT);
    expect(readQuery('x', params('limit=-3')).limit).toBe(DEFAULT_LIMIT);
  });

  it('yalnızca bilinen sıralamayı kabul eder', () => {
    expect(readQuery('x', params('sort=oldest')).sort).toBe('oldest');
    expect(readQuery('x', params('sort=uydurma')).sort).toBe('newest');
  });

  it('boş aramayı yok sayar', () => {
    expect(readQuery('x', params('search=%20%20')).search).toBeUndefined();
  });
});

describe('buildEpisodeQuery', () => {
  const base = { slug: 'bir-bakista', limit: 20, sort: 'newest' as const };

  it('sayfa boyutundan BİR FAZLA satır ister', () => {
    // Fazlalık "devamı var" demektir; ayrı bir sayım sorgusu tabloyu ikinci
    // kez tarardı.
    expect(buildEpisodeQuery(base)).toContain('limit=21');
  });

  it('şovu ve sıralamayı sabitler', () => {
    const query = buildEpisodeQuery(base);
    expect(query).toContain('show_slug=eq.bir-bakista');
    expect(query).toContain('order=published_sort.desc,guid.desc');
  });

  it('eskiden yeniye sıralamada yön döner', () => {
    expect(buildEpisodeQuery({ ...base, sort: 'oldest' })).toContain(
      'order=published_sort.asc,guid.asc',
    );
  });

  it('imleçte ÇİFT anahtar karşılaştırır', () => {
    // Yalnızca tarihe bakmak, aynı saniyeye düşen bölümleri atlatırdı.
    const query = decoded(
      buildEpisodeQuery({
        ...base,
        cursor: { publishedSort: '2026-07-31T15:43:00Z', guid: 'ep-1' },
      }),
    );

    expect(query).toContain('and=(or(published_sort.lt."2026-07-31T15:43:00Z"');
    expect(query).toContain('and(published_sort.eq."2026-07-31T15:43:00Z",guid.lt."ep-1")');
  });

  it('eskiden yeniye giderken karşılaştırma yönü de döner', () => {
    const query = decoded(
      buildEpisodeQuery({
        ...base,
        sort: 'oldest',
        cursor: { publishedSort: '2026-01-01T00:00:00Z', guid: 'a' },
      }),
    );

    expect(query).toContain('published_sort.gt.');
    expect(query).toContain('guid.gt.');
  });

  it('aramayı başlık ve açıklamada yapar', () => {
    const query = decoded(buildEpisodeQuery({ ...base, search: 'deprem' }));
    expect(query).toContain('or(title.ilike."*deprem*",description.ilike."*deprem*")');
  });

  it('arama ve imleci TEK and altında birleştirir', () => {
    // İki ayrı `or` parametresi PostgREST'te birbirini ezerdi.
    const query = decoded(
      buildEpisodeQuery({
        ...base,
        search: 'x',
        cursor: { publishedSort: '2026-01-01T00:00:00Z', guid: 'a' },
      }),
    );

    expect(query.match(/and=\(/g)).toHaveLength(1);
    expect(query).toContain('published_sort.lt.');
    expect(query).toContain('title.ilike.');
  });

  it('değerleri tırnaklar — virgüllü guid sorguyu bölmez', () => {
    const query = decoded(
      buildEpisodeQuery({
        ...base,
        cursor: { publishedSort: '2026-01-01T00:00:00Z', guid: 'a,b(c)' },
      }),
    );

    expect(query).toContain('guid.lt."a,b(c)"');
  });

  it('filtre yoksa and eklemez', () => {
    expect(buildEpisodeQuery(base)).not.toContain('and=(');
  });
});
