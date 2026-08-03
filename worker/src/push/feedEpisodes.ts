import { readAttribute, readTag } from '../xml';

/**
 * RSS gövdesinden bölüm okuma — saf, ayrı test edilir.
 *
 * Ayrıştırma taramadan AYRI durur: tarama ağ, kuyruk ve veritabanıyla
 * uğraşırken burada yalnızca metin vardır. Bu sayede yayıncıların bozuk
 * biçimleri, ağ kurmadan test edilebilir.
 */

/**
 * Rutin taramada işlenecek en fazla bölüm.
 *
 * Arşivler büyüktür (tek bir şovda 1900+ bölüm, ~4 MB feed). Bunu her turda
 * baştan işlemek, hiç değişmemiş binlerce satırı boşuna yeniden yazmaktı.
 * Rutin turun tek sorusu "yeni bölüm çıktı mı" olduğu için en yeniler yeter;
 * arşivin tamamı arşiv doldurma kipinde bir kez işlenir.
 */
export const SCAN_LIMIT = 100;

/** Feed'den okunan tek bölüm. */
export interface FeedEpisode {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly audioUrl: string;
  readonly imageUrl?: string;
  readonly durationSec?: number;
  readonly publishedAt?: string;
}

/**
 * RSS gövdesinden bölümleri okur.
 *
 * Ses dosyası (`enclosure`) olmayan öğeler ATLANIR: çalınamayan bir kayıt
 * bölüm listesinde yer tutmamalı.
 *
 * Tam bir XML ayrıştırıcı yerine hedefli okuma yapılır: Worker bundle'ına XML
 * bağımlılığı eklememek için `<item>` blokları düz metin olarak taranır.
 * İhtiyacımız olan alan kümesi dar ve RSS'te bu alanların biçimi sabittir.
 *
 * @param limit En fazla kaç bölüm okunacağı. Feed'ler en yeniden eskiye
 *   sıralıdır, dolayısıyla sınır her zaman EN YENİLERİ tutar.
 */
export const parseEpisodes = (xml: string, limit = SCAN_LIMIT): FeedEpisode[] => {
  const episodes: FeedEpisode[] = [];
  let cursor = 0;

  while (episodes.length < limit) {
    const start = xml.indexOf('<item', cursor);
    if (start === -1) {
      break;
    }
    const end = xml.indexOf('</item>', start);
    const item = xml.slice(start, end === -1 ? undefined : end);
    cursor = end === -1 ? xml.length : end + 7;

    const audioUrl = readAttribute(item, 'enclosure', 'url');
    if (!audioUrl) {
      continue;
    }
    const id = readTag(item, 'guid') ?? audioUrl;

    episodes.push({
      id,
      title: readTag(item, 'title') ?? 'İsimsiz bölüm',
      description: readTag(item, 'description'),
      audioUrl,
      imageUrl: readAttribute(item, 'itunes:image', 'href'),
      durationSec: parseDuration(readTag(item, 'itunes:duration')),
      publishedAt: parseDate(readTag(item, 'pubDate')),
    });

    if (end === -1) {
      break;
    }
  }

  return episodes;
};

/** `HH:MM:SS`, `MM:SS` ya da saniye — saniyeye çevirir. */
const parseDuration = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) {
    return undefined;
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
};

/** RFC 822 tarihini ISO'ya çevirir; çözülemezse alan boş bırakılır. */
const parseDate = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

