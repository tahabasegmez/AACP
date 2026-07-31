import { describe, expect, it } from 'vitest';
import { parseEpisodes } from '../push/FeedWatcher';

const feed = (items: string): string =>
  `<?xml version="1.0"?><rss><channel><title>Şov</title>${items}</channel></rss>`;

const item = (fields: string): string => `<item>${fields}</item>`;

describe('parseEpisodes', () => {
  it('temel alanları okur', () => {
    const xml = feed(
      item(
        '<guid>ep1</guid>' +
          '<title>Birinci bölüm</title>' +
          '<description>Açıklama</description>' +
          '<enclosure url="https://media/ep1.mp3" type="audio/mpeg"/>' +
          '<itunes:duration>01:02:03</itunes:duration>' +
          '<pubDate>Mon, 20 Jul 2026 10:00:00 GMT</pubDate>',
      ),
    );

    const [episode] = parseEpisodes(xml);

    expect(episode.id).toBe('ep1');
    expect(episode.title).toBe('Birinci bölüm');
    expect(episode.description).toBe('Açıklama');
    expect(episode.audioUrl).toBe('https://media/ep1.mp3');
    expect(episode.durationSec).toBe(3723);
    expect(episode.publishedAt).toBe('2026-07-20T10:00:00.000Z');
  });

  it('CDATA içeriğini çözer', () => {
    const xml = feed(
      item(
        '<title><![CDATA[Köşeli & işaretli]]></title>' +
          '<enclosure url="https://media/a.mp3"/>',
      ),
    );

    expect(parseEpisodes(xml)[0].title).toBe('Köşeli & işaretli');
  });

  it('ses dosyası olmayan öğeyi ATLAR', () => {
    const xml = feed(
      item('<guid>yok</guid><title>Sessiz</title>') +
        item('<guid>var</guid><title>Sesli</title><enclosure url="https://m/a.mp3"/>'),
    );

    // Çalınamayan kayıt bölüm listesinde yer tutmamalı.
    expect(parseEpisodes(xml).map(e => e.id)).toEqual(['var']);
  });

  it('guid yoksa ses adresini kimlik olarak kullanır', () => {
    const xml = feed(item('<title>X</title><enclosure url="https://media/x.mp3"/>'));
    expect(parseEpisodes(xml)[0].id).toBe('https://media/x.mp3');
  });

  it('birden çok bölümü feed sırasıyla döner', () => {
    const xml = feed(
      item('<guid>a</guid><enclosure url="https://m/a.mp3"/>') +
        item('<guid>b</guid><enclosure url="https://m/b.mp3"/>'),
    );

    expect(parseEpisodes(xml).map(e => e.id)).toEqual(['a', 'b']);
  });

  it('MM:SS biçimindeki süreyi çözer', () => {
    const xml = feed(
      item('<enclosure url="https://m/a.mp3"/><itunes:duration>12:30</itunes:duration>'),
    );
    expect(parseEpisodes(xml)[0].durationSec).toBe(750);
  });

  it('saniye olarak verilen süreyi çözer', () => {
    const xml = feed(
      item('<enclosure url="https://m/a.mp3"/><itunes:duration>900</itunes:duration>'),
    );
    expect(parseEpisodes(xml)[0].durationSec).toBe(900);
  });

  it('çözülemeyen tarihi boş bırakır (kayıt yine yazılır)', () => {
    const xml = feed(
      item('<enclosure url="https://m/a.mp3"/><pubDate>bozuk tarih</pubDate>'),
    );

    const [episode] = parseEpisodes(xml);
    expect(episode.publishedAt).toBeUndefined();
    expect(episode.audioUrl).toBe('https://m/a.mp3');
  });

  it('bölümü olmayan feed boş dizi döner', () => {
    expect(parseEpisodes(feed(''))).toEqual([]);
  });
});
