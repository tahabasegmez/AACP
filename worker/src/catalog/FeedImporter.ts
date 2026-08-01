import { channelHeader, readAttribute, readTag, slugFromFeedUrl } from '../xml';

/** Feed'in kanal başlığından okunan şov meta verisi. */
export interface ImportedShow {
  readonly slug: string;
  readonly feedUrl: string;
  readonly title: string;
  readonly description?: string;
  readonly imageUrl?: string;
  readonly author?: string;
  readonly language?: string;
  readonly categories: string[];
}

/** Feed çekme zaman aşımı — cron/istek penceresini kilitlemesin. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * Bir RSS gövdesinden şov meta verisini çıkarır (saf fonksiyon).
 *
 * Katalog artık elle yazılmaz: feed'in kendi kanal bilgisi yetkili kaynaktır.
 * Böylece yayıncı başlığı ya da kapağı değiştirdiğinde katalog kendiliğinden
 * doğru kalır.
 */
export const parseShow = (xml: string, feedUrl: string): ImportedShow | null => {
  const channel = channelHeader(xml);
  const title = readTag(channel, 'title');
  if (!title) {
    // Başlıksız feed katalogda yer tutmamalı; muhtemelen hatalı bir adres.
    return null;
  }

  return {
    slug: slugFromFeedUrl(feedUrl),
    feedUrl,
    title,
    description:
      readTag(channel, 'itunes:summary') ?? readTag(channel, 'description'),
    // iTunes kapağı tercih edilir (kare ve yüksek çözünürlüklüdür).
    imageUrl:
      readAttribute(channel, 'itunes:image', 'href') ?? readTag(channel, 'url'),
    author: readTag(channel, 'itunes:author'),
    language: readTag(channel, 'language'),
    categories: readCategories(channel),
  };
};

/**
 * FeedImporter — feed adreslerinden şov meta verisi toplar.
 *
 * Ağ erişimi burada, ayrıştırma `parseShow`'da: ayrıştırma saf kaldığı için
 * ağ olmadan test edilebilir.
 */
export class FeedImporter {
  /**
   * Verilen adresleri çeker ve çözebildiklerini döner.
   *
   * Bir feed'in hatası diğerlerini ETKİLEMEZ: 20 şovluk bir aktarımda tek
   * bozuk adres tüm işi düşürmemeli. Başarısızlar ayrıca raporlanır.
   */
  async importMany(feedUrls: readonly string[]): Promise<{
    shows: ImportedShow[];
    failed: string[];
  }> {
    const results = await Promise.all(
      feedUrls.map(async url => ({ url, show: await this.importOne(url) })),
    );

    return {
      shows: results
        .map(r => r.show)
        .filter((show): show is ImportedShow => show !== null),
      failed: results.filter(r => r.show === null).map(r => r.url),
    };
  }

  /** Tek bir feed'i çeker; çözülemezse `null`. */
  async importOne(feedUrl: string): Promise<ImportedShow | null> {
    try {
      const response = await fetch(feedUrl, {
        headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        return null;
      }
      return parseShow(await response.text(), feedUrl);
    } catch {
      return null;
    }
  }
}

/** `<itunes:category text="...">` etiketlerini toplar (iç içe olanlar dahil). */
const readCategories = (channel: string): string[] => {
  const matches = channel.matchAll(/<itunes:category[^>]*\btext=["']([^"']+)["']/gi);
  return [...new Set([...matches].map(match => match[1]))];
};
