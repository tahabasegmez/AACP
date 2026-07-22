import { AppError } from '@core/error';
import { XmlParser } from '@core/ports';
import { XMLParser } from 'fast-xml-parser';

/**
 * FastXmlParser — XmlParser portunun fast-xml-parser tabanlı implementasyonu.
 *
 * ÖNEMLİ: Namespace önekleri KORUNUR (removeNSPrefix kullanmıyoruz). Çünkü
 * Transistor feed'lerinde `<title>` ile `<itunes:title>`, `<image>` ile
 * `<itunes:image>`, `<itunes:episode>` ile `<podcast:episode>` aynı anda bulunur;
 * önek atılırsa bunlar tek anahtara düşüp diziye dönüşür ve veri bozulur.
 * Önekleri koruyarak `itunes:author`, `itunes:image` gibi alanlara net erişiriz.
 *
 * Ayarlar:
 *   - ignoreAttributes:false → `<enclosure url=... />` → `{ enclosure: { url, type, length } }`
 *   - attributeNamePrefix:'' → attribute isimleri öneksiz (url, href, length ...)
 *   - Metin düğümü adı '#text' (varsayılan) — mapper bunu okur (ör. guid).
 *
 * Bu yapı `data/dto/RssFeedDto` şekliyle birebir uyumludur (gerçek AA feed'i
 * üzerinde doğrulandı).
 */
export class FastXmlParser implements XmlParser {
  private readonly parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
    trimValues: true,
  });

  parse<T = unknown>(xml: string): T {
    try {
      return this.parser.parse(xml) as T;
    } catch (error) {
      throw AppError.parse('XML ayrıştırılamadı', error);
    }
  }
}
