import { describe, expect, it } from 'vitest';
import { parseShow } from '../catalog/FeedImporter';
import { channelHeader, slugFromFeedUrl } from '../xml';

const FEED_URL = 'https://feeds.transistor.fm/bir-bakista';

const feed = (channel: string, items = ''): string =>
  `<?xml version="1.0"?><rss><channel>${channel}${items}</channel></rss>`;

describe('parseShow', () => {
  it('kanal bilgisinden şovu çıkarır', () => {
    const xml = feed(
      '<title>Bir bakışta</title>' +
        '<description>Gündemdeki konular</description>' +
        '<language>tr</language>' +
        '<itunes:author>Anadolu Ajansı</itunes:author>' +
        '<itunes:image href="https://img/kapak.jpg"/>' +
        '<itunes:category text="News"/><itunes:category text="Politics"/>',
    );

    const show = parseShow(xml, FEED_URL);

    expect(show).toEqual({
      slug: 'bir-bakista',
      feedUrl: FEED_URL,
      title: 'Bir bakışta',
      description: 'Gündemdeki konular',
      imageUrl: 'https://img/kapak.jpg',
      author: 'Anadolu Ajansı',
      language: 'tr',
      categories: ['News', 'Politics'],
    });
  });

  it('ŞOV başlığını alır, ilk bölümün başlığını DEĞİL', () => {
    const xml = feed(
      '<title>Şov adı</title><enclosure url="x"/>',
      '<item><title>Bölüm adı</title><enclosure url="https://m/a.mp3"/></item>',
    );

    expect(parseShow(xml, FEED_URL)?.title).toBe('Şov adı');
  });

  it('itunes:summary açıklamayı ezer (daha zengin metin)', () => {
    const xml = feed(
      '<title>X</title><description>kısa</description><itunes:summary>uzun</itunes:summary>',
    );

    expect(parseShow(xml, FEED_URL)?.description).toBe('uzun');
  });

  it('tekrar eden kategorileri teke indirir', () => {
    const xml = feed(
      '<title>X</title><itunes:category text="News"><itunes:category text="News"/></itunes:category>',
    );

    expect(parseShow(xml, FEED_URL)?.categories).toEqual(['News']);
  });

  it('başlıksız feed reddedilir (hatalı adres katalogda yer tutmasın)', () => {
    expect(parseShow(feed('<description>yok</description>'), FEED_URL)).toBeNull();
  });

  it('eksik alanlar boş bırakılır, şov yine aktarılır', () => {
    const show = parseShow(feed('<title>Yalnız başlık</title>'), FEED_URL);

    expect(show?.title).toBe('Yalnız başlık');
    expect(show?.author).toBeUndefined();
    expect(show?.categories).toEqual([]);
  });
});

describe('slugFromFeedUrl', () => {
  it('istemcideki kuralla AYNI kimliği üretir', () => {
    // Kimlik iki tarafta ayrışırsa dinleme kayıtları şovla eşleşmez.
    expect(slugFromFeedUrl('https://feeds.transistor.fm/bir-bakista')).toBe('bir-bakista');
    expect(slugFromFeedUrl('https://feeds.transistor.fm/bir-bakista/')).toBe('bir-bakista');
    expect(slugFromFeedUrl('https://feeds.transistor.fm/bir-bakista?x=1')).toBe('bir-bakista');
  });
});

describe('channelHeader', () => {
  it('ilk bölümden öncesini döner', () => {
    const xml = feed('<title>Şov</title>', '<item><title>Bölüm</title></item>');
    expect(channelHeader(xml)).not.toContain('Bölüm');
  });

  it('bölümü olmayan feed tümüyle kanal sayılır', () => {
    expect(channelHeader(feed('<title>Şov</title>'))).toContain('Şov');
  });
});
