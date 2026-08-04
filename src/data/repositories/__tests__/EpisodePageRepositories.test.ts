import { AppError, Result, fail, ok } from '@core/error';
import { Episode, PodcastFeed, Show } from '@domain/entities';
import {
  EpisodePageQuery,
  EpisodePageRepository,
  EpisodePageResult,
  PodcastFeedRepository,
} from '@domain/repositories';
import { ApiEpisodePageRepository, EpisodeApi } from '../ApiEpisodePageRepository';
import { FallbackEpisodePageRepository } from '../FallbackEpisodePageRepository';
import { FeedEpisodePageRepository } from '../FeedEpisodePageRepository';

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

const ep = (id: string, title: string, publishedAt: string): Episode => ({
  id,
  showId: 'show1',
  title,
  description: '',
  audioUrl: `https://media/${id}.mp3`,
  durationSec: 100,
  publishedAt,
});

const show: Show = {
  id: 'show1',
  title: 'Feed Şov',
  description: '',
  author: '',
  feedUrl: 'https://feeds/show1',
  categories: [],
};

const query = (over: Partial<EpisodePageQuery> = {}): EpisodePageQuery => ({
  showId: 'show1',
  feedUrl: 'https://feeds/show1',
  limit: 2,
  sort: 'newest',
  ...over,
});

// ---------------------------------------------------------------------------

describe('FeedEpisodePageRepository', () => {
  const episodes = [
    ep('a', 'Ekonomi', '2026-01-01T00:00:00.000Z'),
    ep('b', 'Spor', '2026-05-01T00:00:00.000Z'),
    ep('c', 'Ekonomi 2', '2026-03-01T00:00:00.000Z'),
  ];

  const feeds = (result: Result<PodcastFeed>): PodcastFeedRepository => ({
    getFeed: async () => result,
  });
  const okFeeds = feeds(ok({ show, episodes }));

  it('en yeniden eskiye sıralar ve ilk sayfayı döner', async () => {
    const res = await new FeedEpisodePageRepository(okFeeds).getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.items.map(e => e.id)).toEqual(['b', 'c']);
    expect(res.value.page.nextCursor).toBe('2');
  });

  it('imleçle sonraki sayfayı döner ve sonda imleç vermez', async () => {
    const res = await new FeedEpisodePageRepository(okFeeds).getPage(
      query({ cursor: '2' }),
    );

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.items.map(e => e.id)).toEqual(['a']);
    expect(res.value.page.nextCursor).toBeUndefined();
  });

  it('aramayı sayfalamadan ÖNCE uygular', async () => {
    const res = await new FeedEpisodePageRepository(okFeeds).getPage(
      query({ search: 'ekonomi' }),
    );

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.items.map(e => e.id)).toEqual(['c', 'a']);
  });

  it('bozuk imleci listenin başı sayar', async () => {
    const res = await new FeedEpisodePageRepository(okFeeds).getPage(
      query({ cursor: 'saçmalık' }),
    );

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.items.map(e => e.id)).toEqual(['b', 'c']);
  });

  it('şov meta verisini de döner (sunucu kapalıyken katalog boş olabilir)', async () => {
    const res = await new FeedEpisodePageRepository(okFeeds).getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.show?.title).toBe('Feed Şov');
  });

  it('feed hatasını yukarı taşır', async () => {
    const res = await new FeedEpisodePageRepository(
      feeds(fail(AppError.network('yok'))),
    ).getPage(query());

    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('ApiEpisodePageRepository', () => {
  const api = (response: unknown, enabled = true): EpisodeApi & { paths: string[] } => {
    const paths: string[] = [];
    return {
      enabled,
      paths,
      async get<T>(path: string): Promise<T | undefined> {
        paths.push(path);
        if (response instanceof Error) {
          throw response;
        }
        return response as T;
      },
    };
  };

  it('sayfayı ve imleci çözer', async () => {
    const client = api({
      items: [
        {
          id: 'a',
          title: 'Bölüm',
          audioUrl: 'https://m/a.mp3',
          durationSec: 60,
          publishedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      nextCursor: 'sonraki',
    });

    const res = await new ApiEpisodePageRepository(client).getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.items[0].id).toBe('a');
    expect(res.value.page.nextCursor).toBe('sonraki');
  });

  it('sorgu parametrelerini gönderir', async () => {
    const client = api({ items: [] });
    await new ApiEpisodePageRepository(client).getPage(
      query({ cursor: 'c1', search: 'deprem', sort: 'oldest', limit: 30 }),
    );

    expect(client.paths[0]).toContain('/v1/catalog/shows/show1/episodes');
    expect(client.paths[0]).toContain('limit=30');
    expect(client.paths[0]).toContain('sort=oldest');
    expect(client.paths[0]).toContain('cursor=c1');
    expect(client.paths[0]).toContain('search=deprem');
  });

  it('boş arama ve imleci HİÇ göndermez', async () => {
    const client = api({ items: [] });
    await new ApiEpisodePageRepository(client).getPage(query());

    expect(client.paths[0]).not.toContain('cursor=');
    expect(client.paths[0]).not.toContain('search=');
  });

  it('çalınamayan kaydı atlar', async () => {
    // Ses adresi olmayan satır listede yer tutup dokununca hiçbir şey yapmaz.
    const client = api({
      items: [{ id: 'a', title: 'Sessiz' }, { id: 'b', title: 'Sesli', audioUrl: 'https://m/b.mp3' }],
    });

    const res = await new ApiEpisodePageRepository(client).getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.items.map(e => e.id)).toEqual(['b']);
  });

  it('şov meta verisi DÖNMEZ (katalogdan gelir)', async () => {
    const res = await new ApiEpisodePageRepository(api({ items: [] })).getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.show).toBeUndefined();
  });

  it('sunucu kapalıysa hata döner', async () => {
    const res = await new ApiEpisodePageRepository(api({}, false)).getPage(query());
    expect(res.ok).toBe(false);
  });

  it('ağ hatasını Result nesnesine çevirir', async () => {
    const res = await new ApiEpisodePageRepository(api(new Error('koptu'))).getPage(
      query(),
    );
    expect(res.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('FallbackEpisodePageRepository', () => {
  /** Çağrıldığını ve hangi imleci aldığını kaydeden sahte kaynak. */
  const source = (
    result: Result<EpisodePageResult>,
  ): EpisodePageRepository & { cursors: (string | undefined)[] } => {
    const cursors: (string | undefined)[] = [];
    return {
      cursors,
      getPage: async (q: EpisodePageQuery) => {
        cursors.push(q.cursor);
        return result;
      },
    };
  };

  const page = (nextCursor?: string): Result<EpisodePageResult> =>
    ok({ page: { items: [ep('a', 'A', '')], nextCursor } });
  const broken = fail(AppError.network('şema göçü yapılmamış'));

  it('sunucu çalışıyorsa yedeğe hiç gitmez', async () => {
    const fallback = source(page());
    const sut = new FallbackEpisodePageRepository(source(page()), fallback, logger);

    await sut.getPage(query());
    expect(fallback.cursors).toHaveLength(0);
  });

  it('ilk sayfa başarısızsa yedeğe düşer ve SEBEBİ loglar', async () => {
    // Yedek, yapılandırma eksikliğini sessizce gizlerdi.
    const sut = new FallbackEpisodePageRepository(source(broken), source(page()), logger);
    const res = await sut.getPage(query());

    expect(res.ok).toBe(true);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ reason: 'şema göçü yapılmamış' }),
    );
  });

  it('imleci kaynak etiketiyle döner', async () => {
    const sut = new FallbackEpisodePageRepository(source(page('abc')), source(page()), logger);
    const res = await sut.getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.nextCursor).toBe('p:abc');
  });

  it('yedekten gelen sayfanın imleci YEDEK etiketi taşır', async () => {
    const sut = new FallbackEpisodePageRepository(
      source(broken),
      source(page('20')),
      logger,
    );
    const res = await sut.getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.nextCursor).toBe('f:20');
  });

  it('liste BAŞLADIĞI kaynakta devam eder', async () => {
    // İlk sayfa yedekten geldiyse ikinci sayfa da yedekten gelmeli; imleç
    // sunucuya gönderilseydi orada anlamsız olur ve liste kırılırdı.
    const primary = source(page('x'));
    const fallback = source(page('40'));
    const sut = new FallbackEpisodePageRepository(primary, fallback, logger);

    const res = await sut.getPage(query({ cursor: 'f:20' }));

    expect(primary.cursors).toHaveLength(0);
    expect(fallback.cursors).toEqual(['20']); // etiket SOYULMUŞ olarak gider
    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.nextCursor).toBe('f:40');
  });

  it('sunucuda başlayan liste sunucuda devam eder', async () => {
    const primary = source(page('y'));
    const fallback = source(page());
    const sut = new FallbackEpisodePageRepository(primary, fallback, logger);

    await sut.getPage(query({ cursor: 'p:abc' }));

    expect(primary.cursors).toEqual(['abc']);
    expect(fallback.cursors).toHaveLength(0);
  });

  it('SONRAKİ sayfalarda yedeğe DÜŞMEZ', async () => {
    const sut = new FallbackEpisodePageRepository(source(broken), source(page()), logger);
    const res = await sut.getPage(query({ cursor: 'p:abc' }));

    expect(res.ok).toBe(false);
  });

  it('tanınmayan imleç listeyi baştan başlatır', async () => {
    // Uydurma bir imleci kaynağa geçirmek çözülemeyen bir hataya dönüşürdü.
    const primary = source(page('z'));
    const sut = new FallbackEpisodePageRepository(primary, source(page()), logger);

    await sut.getPage(query({ cursor: 'saçmalık' }));

    expect(primary.cursors).toEqual([undefined]);
  });

  it('son sayfada imleç üretmez', async () => {
    const sut = new FallbackEpisodePageRepository(source(page()), source(page()), logger);
    const res = await sut.getPage(query());

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.page.nextCursor).toBeUndefined();
  });
});
