import { AppError, Result, fail, ok } from '@core/error';
import { Episode, PodcastFeed, Show } from '@domain/entities';
import { PodcastFeedRepository } from '@domain/repositories';
import { GetLatestEpisodes } from '../GetLatestEpisodes';

const show: Show = {
  id: 's', title: 'S', description: '', author: 'AA', feedUrl: 'f', categories: [],
};

const ep = (id: string, date: string): Episode => ({
  id, showId: 's', title: id, description: '', audioUrl: `${id}.mp3`,
  durationSec: 10, publishedAt: date,
});

class FakeFeedRepo implements PodcastFeedRepository {
  constructor(private readonly feeds: Record<string, PodcastFeed>) {}
  async getFeed(url: string): Promise<Result<PodcastFeed>> {
    const f = this.feeds[url];
    // Gerçek repo hata durumunda throw etmez, fail(Result) döner.
    return f ? ok(f) : fail(AppError.network('yok'));
  }
}

describe('GetLatestEpisodes', () => {
  const feedA: PodcastFeed = {
    show,
    episodes: [ep('a1', '2026-07-01'), ep('a2', '2026-05-01'), ep('a3', '2026-03-01')],
  };
  const feedB: PodcastFeed = {
    show,
    episodes: [ep('b1', '2026-06-01'), ep('b2', '2026-04-01')],
  };
  const repo = new FakeFeedRepo({ 'A': feedA, 'B': feedB });

  it('feed\'leri birleştirip en yeniye göre sıralar', async () => {
    const sut = new GetLatestEpisodes(repo);
    const res = await sut.execute({ feedUrls: ['A', 'B'], perShow: 2, limit: 10 });
    expect(res.ok && res.value.map(e => e.id)).toEqual(['a1', 'b1', 'a2', 'b2']);
  });

  it('perShow ile şov başına sınırlar', async () => {
    const sut = new GetLatestEpisodes(repo);
    const res = await sut.execute({ feedUrls: ['A'], perShow: 1 });
    expect(res.ok && res.value.map(e => e.id)).toEqual(['a1']);
  });

  it('limit ile toplam sonucu kırpar', async () => {
    const sut = new GetLatestEpisodes(repo);
    const res = await sut.execute({ feedUrls: ['A', 'B'], perShow: 3, limit: 2 });
    expect(res.ok && res.value).toHaveLength(2);
  });

  it('patlayan feed\'i atlar (best-effort)', async () => {
    const sut = new GetLatestEpisodes(repo);
    const res = await sut.execute({ feedUrls: ['A', 'YOK'], perShow: 3 });
    expect(res.ok && res.value.every(e => e.id.startsWith('a'))).toBe(true);
  });
});
