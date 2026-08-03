import { HttpError } from '../errors';

/**
 * Bölüm sayfalamasının sorgu kurulumu — saf, ayrı test edilir.
 *
 * NEDEN İMLEÇ (keyset), offset değil: `offset 10000` veritabanına her
 * seferinde ilk 10.000 satırı saydırır; derin sayfalarda maliyet lineer
 * büyür. İmleç, sıralama anahtarının kaldığı yeri taşır ve sorgu indekste
 * doğrudan oraya atlar — 50. sayfa 1. sayfa kadar ucuzdur.
 *
 * Ayrıca offset, araya yeni bölüm girdiğinde sayfa sınırlarını kaydırır ve
 * kullanıcı aynı bölümü iki kez görür. İmleçte bu olmaz.
 */

/** Tek sayfada dönebilecek en fazla bölüm. */
export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 20;

export type EpisodeSort = 'newest' | 'oldest';

export interface EpisodeQuery {
  readonly slug: string;
  readonly limit: number;
  readonly sort: EpisodeSort;
  readonly search?: string;
  readonly cursor?: EpisodeCursor;
}

/** Sıralamada kalınan yer. */
export interface EpisodeCursor {
  /** `published_sort` değeri (ISO). */
  readonly publishedSort: string;
  /** Eşit tarihlerde sırayı belirleyen ikinci anahtar. */
  readonly guid: string;
}

/**
 * İki alanı ayıran karakter.
 *
 * Boşluk seçilir çünkü ISO tarihinde ASLA boşluk yoktur; GUID'de olabilir, bu
 * yüzden çözerken YALNIZCA İLK boşluk ayraç sayılır. Sabit uzunluk varsaymak
 * ya da tüm boşluklardan bölmek, boşluk içeren GUID'lerde imleci bozardı.
 */
const SEPARATOR = ' ';

/**
 * İmleci metne çevirir.
 *
 * İçerik base64 ile SAKLANIR, şifrelenmez: amaç gizlilik değil, istemcinin
 * imlecin iç yapısına bağlanmasını önlemektir. Alan eklendiğinde eski
 * istemciler kırılmasın diye biçim tek yerde tutulur.
 */
export const encodeCursor = (cursor: EpisodeCursor): string =>
  toBase64(`${cursor.publishedSort}${SEPARATOR}${cursor.guid}`);

/** İmleci çözer; bozuksa isteği reddeder (sessizce başa dönmek veri atlatırdı). */
export const decodeCursor = (raw: string | null): EpisodeCursor | undefined => {
  if (!raw) {
    return undefined;
  }
  try {
    const decoded = fromBase64(raw);
    const at = decoded.indexOf(SEPARATOR);
    if (at > 0) {
      return {
        publishedSort: decoded.slice(0, at),
        guid: decoded.slice(at + SEPARATOR.length),
      };
    }
  } catch {
    // aşağıdaki ortak hataya düşer
  }
  throw HttpError.badRequest('Geçersiz imleç');
};

/**
 * UTF-8 güvenli base64.
 *
 * `btoa` yalnızca Latin-1 kabul eder; Türkçe ya da başka bir alfabe içeren bir
 * GUID doğrudan verildiğinde HATA FIRLATIR ve o şovun sayfalaması tümüyle
 * çalışmaz olurdu. Bu yüzden önce UTF-8 baytlarına çevrilir.
 */
const toBase64 = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const fromBase64 = (value: string): string =>
  new TextDecoder().decode(Uint8Array.from(atob(value), char => char.charCodeAt(0)));

/** İstek parametrelerini doğrulayıp sorguya çevirir. */
export const readQuery = (slug: string, params: URLSearchParams): EpisodeQuery => {
  const requested = Number(params.get('limit') ?? DEFAULT_LIMIT);
  const limit =
    Number.isFinite(requested) && requested > 0
      ? Math.min(MAX_LIMIT, Math.floor(requested))
      : DEFAULT_LIMIT;

  const search = params.get('search')?.trim();

  return {
    slug,
    limit,
    sort: params.get('sort') === 'oldest' ? 'oldest' : 'newest',
    search: search ? search : undefined,
    cursor: decodeCursor(params.get('cursor')),
  };
};

/** Seçilen sütunlar — istemcinin ihtiyacı kadar, fazlası ağ yükü. */
const COLUMNS =
  'guid,title,description,audio_url,image_url,duration_sec,published_at,published_sort';

/**
 * PostgREST sorgu dizesini kurar.
 *
 * Sayfa boyutundan BİR FAZLA satır istenir: dönen satır sayısı sınırı aşıyorsa
 * devamı vardır. Ayrı bir `count` sorgusu çalıştırmak, her sayfa için tabloyu
 * ikinci kez taramak olurdu.
 */
export const buildEpisodeQuery = (query: EpisodeQuery): string => {
  const descending = query.sort === 'newest';
  const direction = descending ? 'desc' : 'asc';

  const parts = [
    `select=${COLUMNS}`,
    `show_slug=eq.${encodeURIComponent(query.slug)}`,
    `order=published_sort.${direction},guid.${direction}`,
    `limit=${query.limit + 1}`,
  ];

  // Filtreler tek bir `and=(...)` altında toplanır: PostgREST'te aynı isimli
  // iki `or` parametresi birbirini ezerdi.
  const filters: string[] = [];

  if (query.cursor) {
    // (published_sort, guid) çiftinin imleçten küçük/büyük olması. Tek sütunla
    // karşılaştırmak, aynı saniyeye düşen bölümlerde kayıt atlatırdı.
    const operator = descending ? 'lt' : 'gt';
    const published = quote(query.cursor.publishedSort);
    const guid = quote(query.cursor.guid);
    filters.push(
      `or(published_sort.${operator}.${published},` +
        `and(published_sort.eq.${published},guid.${operator}.${guid}))`,
    );
  }

  if (query.search) {
    const needle = quote(`*${query.search}*`);
    filters.push(`or(title.ilike.${needle},description.ilike.${needle})`);
  }

  if (filters.length > 0) {
    parts.push(`and=(${filters.join(',')})`);
  }

  return parts.join('&');
};

/**
 * PostgREST değerini tırnaklar.
 *
 * Değerin içindeki virgül, parantez ve nokta filtre dizesini böler; tırnak
 * içine alınmadan gönderilen bir GUID sorguyu bozardı. Tırnak karakteri
 * kaçırılır.
 */
const quote = (value: string): string =>
  encodeURIComponent(`"${value.replace(/"/g, '\\"')}"`);
