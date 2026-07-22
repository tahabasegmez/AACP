import { FastXmlParser } from '@infrastructure';
import { RssFeedDto } from '../../dto';
import { mapRssFeedToPodcastFeed, slugFromFeedUrl } from '../podcastFeedMapper';

/**
 * Parser + mapper entegrasyon testi. Gerçek Transistor/AA feed'inin zorlu
 * durumlarını temsil eden küçük bir fixture kullanır:
 *  - <title> ile <itunes:title> aynı anda (çakışma olmamalı)
 *  - <image><url> ile <itunes:image href> aynı anda (itunes tercih edilmeli)
 *  - attribute'lu <guid isPermaLink>
 *  - "MM:SS" formatlı itunes:duration
 *  - enclosure'ı olmayan item (atlanmalı)
 *  - iç içe itunes:category
 */
const FIXTURE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Test Şov</title>
    <itunes:title>Test Şov (iTunes)</itunes:title>
    <description>Şov açıklaması</description>
    <language>tr</language>
    <link>https://www.aa.com.tr/tr/podcast</link>
    <itunes:author>Anadolu Ajansı</itunes:author>
    <image>
      <url>https://example.com/rss-image.jpg</url>
      <title>Test Şov</title>
    </image>
    <itunes:image href="https://example.com/itunes-image.jpg"/>
    <itunes:category text="News">
      <itunes:category text="News Commentary"/>
    </itunes:category>
    <item>
      <title>Birinci bölüm</title>
      <itunes:episode>2</itunes:episode>
      <guid isPermaLink="false">guid-0001</guid>
      <description><![CDATA[<p>Açıklama 1</p>]]></description>
      <pubDate>Mon, 20 Jul 2026 15:27:21 +0300</pubDate>
      <enclosure url="https://media.transistor.fm/aaa/bbb.mp3" length="19987280" type="audio/mpeg"/>
      <itunes:duration>20:30</itunes:duration>
      <itunes:image href="https://example.com/ep1.jpg"/>
    </item>
    <item>
      <title>Enclosure'suz bölüm (atlanmalı)</title>
      <guid isPermaLink="false">guid-0002</guid>
      <itunes:duration>90</itunes:duration>
    </item>
  </channel>
</rss>`;

const FEED_URL = 'https://feeds.transistor.fm/test-sov';

const parseFixture = (): RssFeedDto => {
  const parser = new FastXmlParser();
  const doc = parser.parse<{ rss?: RssFeedDto }>(FIXTURE);
  return doc.rss ?? {};
};

describe('slugFromFeedUrl', () => {
  it('feed URL sonundan slug çıkarır', () => {
    expect(slugFromFeedUrl('https://feeds.transistor.fm/bir-bakista')).toBe('bir-bakista');
    expect(slugFromFeedUrl('https://feeds.transistor.fm/bir-bakista/')).toBe('bir-bakista');
    expect(slugFromFeedUrl('https://feeds.transistor.fm/x?y=1')).toBe('x');
  });
});

describe('mapRssFeedToPodcastFeed', () => {
  const feed = mapRssFeedToPodcastFeed(parseFixture(), FEED_URL);

  it('şov meta verisini doğru map eder', () => {
    expect(feed.show.id).toBe('test-sov');
    expect(feed.show.title).toBe('Test Şov'); // <title>, itunes:title ile karışmadı
    expect(feed.show.author).toBe('Anadolu Ajansı');
    expect(feed.show.language).toBe('tr');
    expect(feed.show.feedUrl).toBe(FEED_URL);
    expect(feed.show.websiteUrl).toBe('https://www.aa.com.tr/tr/podcast');
  });

  it('itunes:image href, RSS <image><url> yerine tercih edilir', () => {
    expect(feed.show.imageUrl).toBe('https://example.com/itunes-image.jpg');
  });

  it('iç içe kategorileri düzleştirir', () => {
    expect(feed.show.categories).toEqual(['News', 'News Commentary']);
  });

  it('enclosure olmayan bölümü atlar', () => {
    expect(feed.episodes).toHaveLength(1);
    expect(feed.episodes[0].id).toBe('guid-0001');
  });

  it('bölüm alanlarını doğru map eder', () => {
    const ep = feed.episodes[0];
    expect(ep.title).toBe('Birinci bölüm');
    expect(ep.showId).toBe('test-sov');
    expect(ep.audioUrl).toBe('https://media.transistor.fm/aaa/bbb.mp3');
    expect(ep.mimeType).toBe('audio/mpeg');
    expect(ep.episodeNumber).toBe(2);
    expect(ep.fileSizeBytes).toBe(19987280);
    expect(ep.imageUrl).toBe('https://example.com/ep1.jpg');
  });

  it('"MM:SS" süreyi saniyeye çevirir', () => {
    expect(feed.episodes[0].durationSec).toBe(20 * 60 + 30); // 1230
  });

  it('pubDate ISO 8601\'e çevrilir', () => {
    expect(feed.episodes[0].publishedAt).toBe(new Date('Mon, 20 Jul 2026 15:27:21 +0300').toISOString());
  });
});
