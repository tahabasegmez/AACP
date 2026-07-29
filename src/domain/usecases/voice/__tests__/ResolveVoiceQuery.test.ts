import { ok } from '@core/error';
import { Episode, PodcastFeed, Show } from '../../../entities';
import { PodcastFeedRepository, ShowCatalogRepository } from '../../../repositories';
import { ResolveVoiceQuery } from '../ResolveVoiceQuery';

const show = (id: string, title: string, feedUrl: string): Show => ({
  id,
  title,
  description: '',
  author: 'Anadolu Ajansı',
  feedUrl,
  categories: [],
});

const episode = (id: string, title: string, showId: string): Episode => ({
  id,
  showId,
  title,
  description: '',
  audioUrl: `https://${id}.mp3`,
  durationSec: 600,
  publishedAt: '',
});

const shows = [
  show('s1', 'Bir bakışta', 'https://f1'),
  show('s2', 'Analiz ve görüşler', 'https://f2'),
];

/** Feed'ler: her şovun bölümleri (en yeni önce). */
const feeds: Record<string, Episode[]> = {
  'https://f1': [episode('e1a', 'Seçim özel', 's1'), episode('e1b', 'Ekonomi', 's1')],
  'https://f2': [episode('e2a', 'Deprem raporu', 's2')],
};

const catalog: ShowCatalogRepository = {
  getShows: async () => ok(shows),
} as unknown as ShowCatalogRepository;

const podcastFeeds: PodcastFeedRepository = {
  getFeed: async (feedUrl: string) =>
    ok({ show: shows[0], episodes: feeds[feedUrl] ?? [] } as unknown as PodcastFeed),
} as unknown as PodcastFeedRepository;

const sut = new ResolveVoiceQuery(catalog, podcastFeeds);

const resolve = async (query: string) => {
  const result = await sut.execute({ query });
  return result.ok ? result.value : null;
};

describe('ResolveVoiceQuery', () => {
  it('şov adını tanır ve o şovun EN SON bölümünü seçer', async () => {
    const match = await resolve('Bir bakışta çal');

    expect(match?.kind).toBe('showLatest');
    expect(match?.show?.id).toBe('s1');
    expect(match?.episode.id).toBe('e1a');
  });

  it('komut kelimelerini yok sayar (çal/oynat/aç)', async () => {
    for (const query of ['Bir bakışta oynat', 'Bir bakışta aç', 'bir bakışta dinle']) {
      expect((await resolve(query))?.show?.id).toBe('s1');
    }
  });

  it('büyük/küçük harf ve Türkçe karakter farkını yok sayar', async () => {
    expect((await resolve('BİR BAKIŞTA'))?.show?.id).toBe('s1');
    expect((await resolve('bir bakista'))?.show?.id).toBe('s1');
  });

  it('bölüm başlığıyla eşleşir', async () => {
    const match = await resolve('Deprem raporu çal');

    expect(match?.kind).toBe('episode');
    expect(match?.episode.id).toBe('e2a');
  });

  it('şov adı bölüm başlığına göre ÖNCELİKLİDİR', async () => {
    // "Analiz ve görüşler" hem şov adı; şov eşleşmesi kazanmalı.
    const match = await resolve('Analiz ve görüşler');

    expect(match?.kind).toBe('showLatest');
    expect(match?.show?.id).toBe('s2');
  });

  it('sorgu boşsa ilk şovun son bölümüne düşer', async () => {
    const match = await resolve('podcast çal');

    expect(match?.episode.id).toBe('e1a');
  });

  it('hiçbir şey eşleşmezse yine de çalınabilir bir şey döner', async () => {
    // Araçta "bulamadım" demek yerine bir şey çalmak daha kullanışlıdır.
    const match = await resolve('bulunmayan bir şey');
    expect(match).not.toBeNull();
  });

  it('katalog boşsa null döner', async () => {
    const emptyCatalog = { getShows: async () => ok([]) } as unknown as ShowCatalogRepository;
    const result = await new ResolveVoiceQuery(emptyCatalog, podcastFeeds).execute({
      query: 'herhangi',
    });

    expect(result.ok && result.value).toBeNull();
  });
});
