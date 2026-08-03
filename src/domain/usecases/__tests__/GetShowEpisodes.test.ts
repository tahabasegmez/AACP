import { AppError, Result, fail, ok } from '@core/error';
import { Episode, Show } from '@domain/entities';
import {
  EpisodePageQuery,
  EpisodePageRepository,
  EpisodePageResult,
  ShowCatalogRepository,
} from '@domain/repositories';
import { GetShowEpisodes } from '../GetShowEpisodes';

const ep = (id: string): Episode => ({
  id,
  showId: 'show1',
  title: id,
  description: '',
  audioUrl: `https://media/${id}.mp3`,
  durationSec: 100,
  publishedAt: '2026-01-01T00:00:00.000Z',
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

/** Çağrıyı kaydeden sahte depo — use case'in NE SORDUĞU da doğrulanır. */
class FakePages implements EpisodePageRepository {
  calls: EpisodePageQuery[] = [];
  constructor(private readonly result: Result<EpisodePageResult>) {}
  async getPage(query: EpisodePageQuery): Promise<Result<EpisodePageResult>> {
    this.calls.push(query);
    return this.result;
  }
}

class FakeCatalog implements ShowCatalogRepository {
  constructor(private readonly found = true) {}
  async getShows() {
    return ok([] as readonly Show[]);
  }
  async getShowById(id: string): Promise<Result<Show>> {
    return this.found
      ? ok({ ...feedShow, id, title: 'Katalog Şov', description: 'Katalog açıklama' })
      : fail(AppError.notFound('yok'));
  }
}

const pageOf = (show?: Show): Result<EpisodePageResult> =>
  ok({ page: { items: [ep('a')], nextCursor: 'c1' }, show });

describe('GetShowEpisodes', () => {
  it('sayfayı olduğu gibi taşır (imleç dahil)', async () => {
    const sut = new GetShowEpisodes(new FakePages(pageOf(feedShow)), new FakeCatalog());
    const res = await sut.execute({ feedUrl: 'https://feeds/show1' });

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.episodes.items.map(e => e.id)).toEqual(['a']);
    expect(res.value.episodes.nextCursor).toBe('c1');
  });

  it('arama, sıralama ve imleci depoya DEVREDER', async () => {
    // Bunları bellekte yapmak, önce tüm listeyi indirmek demekti.
    const pages = new FakePages(pageOf(feedShow));
    const sut = new GetShowEpisodes(pages, new FakeCatalog());

    await sut.execute({
      showId: 'show1',
      search: 'deprem',
      sort: 'oldest',
      cursor: 'abc',
      limit: 50,
    });

    expect(pages.calls[0]).toMatchObject({
      showId: 'show1',
      search: 'deprem',
      sort: 'oldest',
      cursor: 'abc',
      limit: 50,
    });
  });

  it('showId verilmezse feed adresinden türetir', async () => {
    // Sunucu şovu kimlikle sorgular; kural sunucudakiyle aynı olmalı.
    const pages = new FakePages(pageOf(feedShow));
    const sut = new GetShowEpisodes(pages, new FakeCatalog());

    await sut.execute({ feedUrl: 'https://feeds.transistor.fm/bir-bakista/?x=1' });

    expect(pages.calls[0].showId).toBe('bir-bakista');
  });

  it('kaynak meta veri biliyorsa katalogla birleştirir (kaynak öncelikli)', async () => {
    const sut = new GetShowEpisodes(new FakePages(pageOf(feedShow)), new FakeCatalog());
    const res = await sut.execute({ showId: 'show1' });

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.show.title).toBe('Feed Şov');
  });

  it('kaynak meta veri bilmiyorsa katalog tek başına yeter', async () => {
    // Sunucu kaynağı yalnızca bölüm döner; şov bilgisi katalogdan gelir.
    const sut = new GetShowEpisodes(new FakePages(pageOf()), new FakeCatalog());
    const res = await sut.execute({ showId: 'show1' });

    if (!res.ok) throw new Error('beklenmedik hata');
    expect(res.value.show.title).toBe('Katalog Şov');
  });

  it('ne kaynak ne katalog şovu biliyorsa NOT_FOUND döner', async () => {
    const sut = new GetShowEpisodes(new FakePages(pageOf()), new FakeCatalog(false));
    const res = await sut.execute({ showId: 'yok' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('feedUrl/showId yoksa NOT_FOUND döner', async () => {
    const sut = new GetShowEpisodes(new FakePages(pageOf()), new FakeCatalog());
    const res = await sut.execute({});

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NOT_FOUND');
  });

  it('depo hatasını yukarı taşır', async () => {
    const failing = new FakePages(fail(AppError.network('patladı')));
    const sut = new GetShowEpisodes(failing, new FakeCatalog());
    const res = await sut.execute({ feedUrl: 'https://feeds/show1' });

    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.error.code).toBe('NETWORK');
  });
});
