import { Episode } from '../Episode';
import { searchEpisodes, sortEpisodes } from '../episodeQueries';

const ep = (id: string, title: string, publishedAt: string, description = ''): Episode => ({
  id,
  showId: 's',
  title,
  description,
  audioUrl: `https://x/${id}.mp3`,
  durationSec: 100,
  publishedAt,
});

describe('sortEpisodes', () => {
  const list = [
    ep('a', 'Eski', '2026-01-01T00:00:00.000Z'),
    ep('b', 'Yeni', '2026-07-01T00:00:00.000Z'),
    ep('c', 'Orta', '2026-04-01T00:00:00.000Z'),
  ];

  it('newest: en yeni önce', () => {
    expect(sortEpisodes(list, 'newest').map(e => e.id)).toEqual(['b', 'c', 'a']);
  });

  it('oldest: en eski önce', () => {
    expect(sortEpisodes(list, 'oldest').map(e => e.id)).toEqual(['a', 'c', 'b']);
  });

  it('geçersiz tarih en sona atılır', () => {
    const withBad = [...list, ep('d', 'Tarihsiz', '')];
    expect(sortEpisodes(withBad, 'newest').map(e => e.id).at(-1)).toBe('d');
  });

  it('girdiyi bozmaz (immutable)', () => {
    const copy = [...list];
    sortEpisodes(list, 'oldest');
    expect(list).toEqual(copy);
  });
});

describe('searchEpisodes', () => {
  const list = [
    ep('a', 'Ekonomi gündemi', '2026-01-01', 'Piyasalar'),
    ep('b', 'Spor', '2026-01-02', 'Futbol ekonomisi'),
    ep('c', 'Kültür', '2026-01-03', 'Sanat'),
  ];

  it('başlıkta arar', () => {
    expect(searchEpisodes(list, 'ekonomi').map(e => e.id)).toEqual(['a', 'b']);
  });

  it('Türkçe büyük/küçük harf duyarsız (İ/ı)', () => {
    expect(searchEpisodes(list, 'EKONOMİ').map(e => e.id)).toEqual(['a', 'b']);
  });

  it('boş sorgu tümünü döner', () => {
    expect(searchEpisodes(list, '   ')).toHaveLength(3);
  });
});
