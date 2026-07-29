import { Episode, PlaybackProgress, Playlist, Show } from '@domain/entities';
import {
  buildList,
  episodesToItems,
  playlistsToItems,
  resumeToItems,
  showsToItems,
  withoutImages,
} from '../sections';

const show: Show = {
  id: 's1',
  title: 'Şov 1',
  description: 'Açıklama',
  author: 'AA',
  feedUrl: 'https://f1',
  categories: [],
  imageUrl: 'https://img/s1.jpg',
};

const episode: Episode = {
  id: 'e1',
  showId: 's1',
  title: 'Bölüm 1',
  description: '',
  audioUrl: 'https://a1.mp3',
  durationSec: 3661,
  publishedAt: '',
  imageUrl: 'https://img/e1.jpg',
};

describe('showsToItems', () => {
  it('başlık, açıklama ve kapak döner', () => {
    const [item] = showsToItems([show]);

    expect(item.text).toBe('Şov 1');
    expect(item.detailText).toBe('Açıklama');
    expect(item.image).toEqual({ uri: 'https://img/s1.jpg' });
    // Alt seviyeye gidiliyor → ok işareti.
    expect(item.showsDisclosureIndicator).toBe(true);
  });

  it('kapak yoksa image alanı verilmez', () => {
    const [item] = showsToItems([{ ...show, imageUrl: undefined }]);
    expect(item.image).toBeUndefined();
  });

  it('açıklama boşsa detay metni verilmez', () => {
    const [item] = showsToItems([{ ...show, description: '' }]);
    expect(item.detailText).toBeUndefined();
  });
});

describe('episodesToItems', () => {
  it('başlık, biçimlenmiş süre ve kapak döner', () => {
    const [item] = episodesToItems([episode]);

    expect(item.text).toBe('Bölüm 1');
    expect(item.detailText).toBe('1:01:01');
    expect(item.image).toEqual({ uri: 'https://img/e1.jpg' });
  });

  it('çalan bölümü işaretler', () => {
    const [item] = episodesToItems([episode], 'e1');
    expect(item.isPlaying).toBe(true);
  });

  it('çalmayan bölümü işaretlemez', () => {
    const [item] = episodesToItems([episode], 'baska');
    expect(item.isPlaying).toBe(false);
  });
});

describe('resumeToItems', () => {
  const progress: PlaybackProgress = {
    episodeId: 'e1',
    positionSec: 60,
    durationSec: 360,
    updatedAt: '2026-07-20T10:00:00.000Z',
    completed: false,
    episodeTitle: 'Yarım kalan',
    artworkUrl: 'https://img/r.jpg',
  };

  it('KALAN süreyi gösterir (toplam süreyi değil)', () => {
    const [item] = resumeToItems([progress]);

    expect(item.text).toBe('Yarım kalan');
    expect(item.detailText).toBe('5:00 kaldı');
  });

  it('bitmeye yakın kayıtta uygun metin verir', () => {
    const [item] = resumeToItems([{ ...progress, positionSec: 360 }]);
    expect(item.detailText).toBe('Neredeyse bitti');
  });

  it('başlık yoksa güvenli varsayılan kullanır', () => {
    const [item] = resumeToItems([{ ...progress, episodeTitle: undefined }]);
    expect(item.text).toBe('Bölüm');
  });
});

describe('playlistsToItems', () => {
  const playlist: Playlist = {
    id: 'pl1',
    name: 'Sabah',
    episodes: [episode],
    createdAt: 1,
    updatedAt: 1,
  };

  it('ad ve bölüm sayısını gösterir', () => {
    const [item] = playlistsToItems([playlist]);

    expect(item.text).toBe('Sabah');
    expect(item.detailText).toBe('1 bölüm');
    expect(item.showsDisclosureIndicator).toBe(true);
  });

  it('kapak yoksa ilk bölümün görseline düşer', () => {
    const [item] = playlistsToItems([playlist]);
    expect(item.image).toEqual({ uri: 'https://img/e1.jpg' });
  });

  it('boş liste için uygun metin verir', () => {
    const [item] = playlistsToItems([{ ...playlist, episodes: [] }]);
    expect(item.detailText).toBe('Boş liste');
  });
});

describe('buildList', () => {
  const row = (text: string) => ({ text });

  it('davranışları bölümler arasında SÜREKLİ index ile birleştirir', () => {
    const seen: string[] = [];
    const list = buildList([
      {
        header: 'A',
        items: [row('a1'), row('a2')],
        actions: [
          () => {
            seen.push('a1');
          },
          () => {
            seen.push('a2');
          },
        ],
      },
      {
        header: 'B',
        items: [row('b1')],
        actions: [
          () => {
            seen.push('b1');
          },
        ],
      },
    ]);

    // İkinci bölümün ilk satırı, birinci bölümün öğe sayısından devam eder.
    list.actions[2]();
    expect(seen).toEqual(['b1']);
  });

  it('boş grupları atlar (başlık yer kaplamasın)', () => {
    const list = buildList([
      { header: 'Boş', items: [], actions: [] },
      { header: 'Dolu', items: [row('x')], actions: [() => undefined] },
    ]);

    expect(list.sections).toHaveLength(1);
    expect(list.sections[0].header).toBe('Dolu');
    expect(list.actions).toHaveLength(1);
  });

  it('withoutImages kapakları düşürür, geri kalanı korur', () => {
    const sections = [
      {
        header: 'A',
        items: [{ text: 'x', detailText: 'd', image: { uri: 'https://a.jpg' }, isPlaying: true }],
      },
    ];

    expect(withoutImages(sections)).toEqual([
      { header: 'A', items: [{ text: 'x', detailText: 'd', isPlaying: true }] },
    ]);
    // Girdi değişmez (saf fonksiyon).
    expect(sections[0].items[0].image).toEqual({ uri: 'https://a.jpg' });
  });

  it('başlıksız grup başlıksız bölüm üretir', () => {
    const list = buildList([{ items: [row('x')], actions: [() => undefined] }]);
    expect(list.sections[0]).toEqual({ items: [row('x')] });
  });
});
