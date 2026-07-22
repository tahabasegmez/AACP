import { HttpClient, XmlParser } from '@core/ports';
import { RssFeedDto } from '../../dto';

/**
 * RssFeedDataSource — bir RSS feed URL'inden ham DTO üretir.
 *
 * Sorumluluğu net: HTTP ile XML'i çek, parse et, DTO döndür. Domain'e dönüşüm
 * (mapping) burada YAPILMAZ; o iş repository + mapper'ındadır.
 *
 * fast-xml-parser tipik olarak `{ rss: { channel: {...} } }` yapısı üretir;
 * biz channel'a kadar inip RssFeedDto döneriz.
 */
export class RssFeedDataSource {
  constructor(
    private readonly http: HttpClient,
    private readonly parser: XmlParser,
  ) {}

  async fetch(feedUrl: string): Promise<RssFeedDto> {
    const xml = await this.http.getText(feedUrl);
    const parsed = this.parser.parse<{ rss?: RssFeedDto }>(xml);
    return parsed.rss ?? {};
  }
}
