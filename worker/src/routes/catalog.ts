import { HttpError } from '../errors';
import { requireAdmin } from '../auth';
import { CatalogImportService } from '../catalog/CatalogImportService';
import {
  buildEpisodeQuery,
  encodeCursor,
  readQuery,
} from '../catalog/episodeQuery';
import { Supabase, type SupabaseScope } from '../supabase';
import { json, ok, type Ctx } from '../router';

/** İstemcinin beklediği katalog girdisi (şov listesi). */
export interface CatalogEntry {
  readonly slug: string;
  readonly feedUrl: string;
  readonly title: string;
  readonly imageUrl?: string;
  readonly description?: string;
}

/** `shows` tablosu satırı (snake_case). */
export interface ShowRow {
  readonly slug: string;
  readonly feed_url: string;
  readonly title: string;
  readonly description: string | null;
  readonly image_url: string | null;
  readonly author: string | null;
  readonly language: string | null;
  readonly categories: string[] | null;
  readonly active: boolean;
  readonly sort_order: number;
  /** Gömülü: yalnızca en son bölümün tarihi (sıralama için). */
  readonly episodes?: readonly { readonly published_at: string | null }[];
}

/** `episodes` tablosu satırı. */
interface EpisodeRow {
  readonly guid: string;
  readonly title: string;
  readonly description: string | null;
  readonly audio_url: string;
  readonly image_url: string | null;
  readonly duration_sec: number | null;
  readonly published_at: string | null;
  /** Sıralama anahtarı — üretilmiş sütun, hiç boş olmaz (bkz. schema-04). */
  readonly published_sort: string;
}

/**
 * Katalog yanıtlarının kenarda önbelleklenme süresi.
 *
 * Katalog kullanıcıya özel DEĞİLDİR ve yayın hızı dakikalarla ölçülür; kısa
 * bir önbellek, aynı sayfayı isteyen binlerce cihazın veritabanına inmesini
 * engeller. `stale-while-revalidate` sayesinde süre dolduğunda kullanıcı
 * beklemez, tazeleme arkada yapılır.
 */
const CACHE_HEADER = 'public, max-age=60, stale-while-revalidate=300';

/** Herkese açık, önbelleklenebilir yanıt. */
const cacheable = (body: unknown): Response =>
  json(body, 200, { 'Cache-Control': CACHE_HEADER });

/**
 * Katalog uçları — şov listesi ve bölümleri.
 *
 * Katalog artık uygulamaya gömülü bir dosyada ya da tek satırlık JSON'da
 * değil, kendi TABLOSUNDADIR (`shows`). Şov eklemek bir satır işlemidir;
 * uygulama güncellemesi ya da tüm listeyi yeniden yayınlamak gerekmez.
 *
 * Okuma herkese açıktır (kimlik gerekmez): katalog gizli veri değildir ve
 * uygulama ilk açılışta oturum açmadan listeyi görebilmelidir. Yazma
 * `ADMIN_TOKEN` ile korunur.
 */
export const registerCatalogRoutes = (router: {
  get: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  delete?: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  /** Yayındaki şovlar — istemcinin katalog kaynağı. */
  router.get('/v1/catalog', async ctx => {
    // Her şovun EN SON bölümünün tarihi gömülü olarak çekilir; sıralama buna
    // dayanır (bkz. `byFreshness`). PostgREST üst kaydı alt kaydın alanına göre
    // sıralayamadığı için son adım burada atılır — katalog 11 satırlık.
    const rows = await service(ctx).select<ShowRow>(
      'shows',
      'select=slug,feed_url,title,description,image_url,sort_order,' +
        'episodes(published_at)' +
        '&active=is.true' +
        '&episodes.order=published_at.desc.nullslast&episodes.limit=1',
    );
    return ok([...rows].sort(byFreshness).map(toEntry));
  });

  /**
   * Bir şovun bölümleri — İMLEÇLE sayfalanır (bkz. episodeQuery).
   *
   * İstemci artık şov açılışında tüm RSS'i (tek şovda 4 MB'a varan) indirmez;
   * yalnızca gördüğü sayfayı ister. Yanıt kullanıcıya özel değildir, bu yüzden
   * kenarda önbelleklenebilir.
   */
  router.get('/v1/catalog/shows/:slug/episodes', async ctx => {
    const query = readQuery(ctx.params.slug, ctx.query);

    const scope = service(ctx);
    const [rows, shows] = await Promise.all([
      scope.select<EpisodeRow>('episodes', buildEpisodeQuery(query)),
      scope.select<{ image_url: string | null }>(
        'shows',
        `select=image_url&slug=eq.${encodeURIComponent(query.slug)}&limit=1`,
      ),
    ]);

    // Sorgu bir fazla satır ister; fazlalık "devamı var" demektir ve
    // kullanıcıya gösterilmez.
    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    const last = page[page.length - 1];

    // Bölümlerin çoğunda `itunes:image` yoktur; yayıncı yalnızca şov kapağını
    // verir. Yedek OKUMA anında uygulanır, yazarken değil: şov kapağı
    // değiştiğinde tüm bölümler kendiliğinden düzelir, binlerce satır
    // yeniden yazılmaz. İstemcideki RSS yolu da aynı kuralı uygular.
    const showCover = shows[0]?.image_url ?? undefined;

    return cacheable({
      items: page.map(row => ({
        id: row.guid,
        showId: query.slug,
        title: row.title,
        description: row.description ?? '',
        audioUrl: row.audio_url,
        imageUrl: row.image_url ?? showCover,
        durationSec: row.duration_sec ?? 0,
        publishedAt: row.published_at ?? '',
      })),
      nextCursor:
        hasMore && last
          ? encodeCursor({ publishedSort: last.published_sort, guid: last.guid })
          : undefined,
    });
  });

  /**
   * Şov ekler/günceller (admin). Tek şov ya da dizi kabul eder.
   *
   * Eski "tüm katalogu yayınla" davranışının yerini alır: liste tümüyle
   * gönderilmediği için yanlış bir istek katalogu boşaltamaz. Bir şovu
   * listeden düşürmek `active: false` demektir.
   */
  router.post('/v1/catalog/shows', async ctx => {
    requireAdmin(ctx);
    const shows = assertShows(ctx.body);

    await service(ctx).upsert('shows', shows, 'slug');
    return ok({ upserted: shows.length });
  });

  /**
   * Katalogu OTOMATİK doldurur — elle şov bilgisi girmenin yerini alır.
   *
   * Gövde boşsa yayıncı hesabındaki şovlar keşfedilir; `feedUrls` verilirse
   * yalnızca onlar aktarılır. Her iki durumda da başlık, açıklama, kapak ve
   * kategoriler FEED'İN KENDİSİNDEN okunur.
   */
  router.post('/v1/catalog/import', async ctx => {
    requireAdmin(ctx);
    const feedUrls = readFeedUrls(ctx.body);

    return ok(await new CatalogImportService(ctx.env).run(feedUrls));
  });

  /**
   * Eski uç — geriye dönük uyumluluk.
   *
   * Şov bilgisini elle vermek için durur (ör. feed'i olmayan bir kayıt).
   * Olağan yol `/v1/catalog/import`'tur. Gönderilen şovlar yazılır; LİSTEDE
   * OLMAYANLAR silinmez (yanlış bir istek katalogu boşaltmasın).
   */
  router.post('/v1/catalog', async ctx => {
    requireAdmin(ctx);
    const shows = assertShows(ctx.body);

    await service(ctx).upsert('shows', shows, 'slug');
    return ok({ upserted: shows.length });
  });

  /** Şovu yayından kaldırır (satır korunur — geçmiş kayıtlar ona referans verir). */
  router.delete?.('/v1/catalog/shows/:slug', async ctx => {
    requireAdmin(ctx);
    const slug = ctx.params.slug;

    await service(ctx).upsert('shows', [{ slug, active: false }], 'slug');
    return ok({ slug, active: false });
  });
};

/**
 * Aktarım gövdesinden feed adreslerini okur.
 *
 * Gövde YOK sayılabilir: adres verilmediğinde keşif devreye girer, bu yüzden
 * boş istek geçerlidir ve hata değildir.
 */
const readFeedUrls = (body: unknown): string[] => {
  const value = (body as { feedUrls?: unknown })?.feedUrls;
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || value.some(url => typeof url !== 'string')) {
    throw HttpError.badRequest('feedUrls bir metin dizisi olmalı');
  }
  return value as string[];
};

/** Katalog kullanıcıya ait değildir → servis kimliği (RLS'e tabi değil). */
const service = (ctx: Ctx): SupabaseScope => Supabase.from(ctx.env).asService();

/** Şovun en son bölümünün zamanı; hiç bölümü yoksa 0. */
const freshness = (row: ShowRow): number => {
  const published = row.episodes?.[0]?.published_at;
  const time = published ? Date.parse(published) : Number.NaN;
  return Number.isNaN(time) ? 0 : time;
};

/**
 * Katalog sırası: EN SON YAYINLANAN ÜSTTE.
 *
 * `sort_order` önce gelir ve bir yönetim kancası olarak durur — varsayılan 0
 * bırakıldığında hiçbir etkisi yoktur, bir şovu tepeye sabitlemek gerekirse
 * tek satırla yapılır. Bölümü olmayan şov (henüz taranmamış) sona düşer;
 * eşitlik başlığa göre çözülür ki sıra turdan tura oynamasın.
 */
export const byFreshness = (a: ShowRow, b: ShowRow): number =>
  a.sort_order - b.sort_order ||
  freshness(b) - freshness(a) ||
  a.title.localeCompare(b.title, 'tr');

const toEntry = (row: ShowRow): CatalogEntry => ({
  slug: row.slug,
  feedUrl: row.feed_url,
  title: row.title,
  imageUrl: row.image_url ?? undefined,
  description: row.description ?? undefined,
});

/**
 * Gövdeyi `shows` satırlarına çevirir.
 *
 * Eksik alanlı girişler sessizce atlanır — bir bozuk kayıt tüm isteği
 * düşürmemeli. Hiç geçerli kayıt yoksa istek reddedilir.
 */
const assertShows = (body: unknown): Record<string, unknown>[] => {
  const items = Array.isArray(body) ? body : [body];

  const rows = items
    .filter((raw): raw is CatalogEntry & Record<string, unknown> => {
      const entry = raw as Partial<CatalogEntry>;
      return (
        typeof entry?.slug === 'string' &&
        entry.slug.length > 0 &&
        typeof entry.feedUrl === 'string' &&
        entry.feedUrl.length > 0 &&
        typeof entry.title === 'string'
      );
    })
    .map(entry => ({
      slug: entry.slug,
      feed_url: entry.feedUrl,
      title: entry.title,
      description: entry.description ?? null,
      image_url: entry.imageUrl ?? null,
      author: (entry.author as string) ?? null,
      language: (entry.language as string) ?? null,
      active: entry.active === undefined ? true : entry.active === true,
      sort_order: typeof entry.sortOrder === 'number' ? entry.sortOrder : 0,
      updated_at: new Date().toISOString(),
    }));

  if (rows.length === 0) {
    throw HttpError.badRequest('En az bir geçerli şov gerekli (slug, feedUrl, title)');
  }
  return rows;
};
