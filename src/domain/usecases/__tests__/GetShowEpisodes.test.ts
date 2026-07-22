import { AppError, Result, fail, ok } from '@core/error';
import { Episode, PodcastFeed, Show } from '@domain/entities';
import { PodcastFeedRepository, ShowCatalogRepository } from '@domain/repositories';
import { GetShowEpisodes } from '../GetShowEpisodes';

const ep = (id: string, title: string, publishedAt: string): Episode => ({
  id,
  showId: 'show1',
  title,
  description: '',
  audioUrl: `https://media/${id}.mp3`,
  durationSec: 100,
  publishedAt,
});

const feedShow: Show = {
  id: 'show1',
  title: 'Feed Şov',
  description: 'Feed açıklama',
  author: 'Anadolu Ajansı',
  imageUrl: 'https://feed/img.jpg',
  feedUrl: 'https://feeds/show1',
  language: 'tr',
  categories: ['News'],
};

const episodes = [
  ep('a', 'Ekonomi', '2026-01-01T00:00:00.000Z'),
  ep('b', 'Spor', '2026-05-01T00:00:00.000Z'),
  ep('c', 'Ekonomi 2', '2026-03-01T00:00:00.000Z'),
];

class FakeFeedRepo implements PodcastFeedRepository {
  constructor(private readonly result: Result<PodcastFeed>) {}
  async getFeed(): Promise<Result<PodcastFeed>> {
    return this.result;
  }
}

class FakeCatalog implements ShowCatalogRepository {
  async getShows() {
    return ok([] as readonly Show[]);
  }
  async getShowById(id: string): Promise<Result<Show>> {
    return ok({ ...feedShow, id, title: 'Katalog Şov', feedUrl: 'https://feeds/show1' });
  }
}

const okFeed = new FakeFeedRepo(ok({ show: feedShow, episodes }));

describe('GetShowEpisodes', () => {
  it('feedUrl ile sayfalı bölüm döner (varsayılan: en yeni önce)', async () => {
    const sut = new GetShowEpisodes(okFeed, new FakeCatalog());
    const res = await sut.execute({ feedUrl: 'https://feeds/show1', limit: 2, offset: 0 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.episodes.items.map(e => e.id)).toEqual(['b', 'c']); // yeni→eski
    expect(res.value.episodes.hasMore).toBe(true);
    expect(res.value.episodes.total).toBe(3);
  });

  it('offset ile sonraki sayfayı döner', async () => {
    const sut = new GetShowEpisodes(okFeed, new FakeCatalog());
    const res = await sut.execute({ feedUrl: 'https://feeds/show1', limit: 2, offset: 2 });
    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.episodes.items.map(e => e.id)).toEqual(['a']);
    expect(res.value.episodes.hasMore).toBe(false);
  });

  it('arama uygular (sayfalamadan önce)', async () => {
    const sut = new GetShowEpisodes(okFeed, new FakeCatalog());
    const res = await sut.execute({ feedUrl: 'https://feeds/show1', search: 'ekonomi' });
    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.episodes.total).toBe(2);
    expect(res.value.episodes.items.map(e => e.id)).toEqual(['c', 'a']);
  });

  it('showId ile katalog fallback + feed enrichment yapar', async () => {
    const sut = new GetShowEpisodes(okFeed, new FakeCatalog());
    const res = await sut.execute({ showId: 'show1' });
    if (!res.ok) throw new Error('beklenmedik hata');
    // feed başlığı önceliklidir (mergeShow)
    expect(res.value.show.title).toBe('Feed Şov');
  });

  it('feedUrl/showId yoksa NOT_FOUND döner', async () => {
    const sut = new GetShowEpisodes(okFeed, new FakeCatalog());
    const res = await sut.execute({});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('feed hatasını yukarı taşır', async () => {
    const failing = new FakeFeedRepo(fail(AppError.network('feed patladı')));
    const sut = new GetShowEpisodes(failing, new FakeCatalog());
    const res = await sut.execute({ feedUrl: 'https://feeds/show1' });
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NETWORK');
  });
});
