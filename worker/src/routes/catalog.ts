import { HttpError } from '../errors';
import { requireAdmin } from '../auth';
import { Supabase, type SupabaseScope } from '../supabase';
import { ok, type Ctx } from '../router';

/** İstemcinin beklediği katalog girdisi (şov listesi). */
export interface CatalogEntry {
  readonly slug: string;
  readonly feedUrl: string;
  readonly title: string;
  readonly imageUrl?: string;
  readonly description?: string;
}

/** `shows` tablosu satırı (snake_case). */
interface ShowRow {
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
}

/** Tek istekte dönen en fazla bölüm. */
const MAX_EPISODES = 200;

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
    const rows = await service(ctx).select<ShowRow>(
      'shows',
      'select=slug,feed_url,title,description,image_url' +
        '&active=is.true&order=sort_order.asc,title.asc',
    );
    return ok(rows.map(toEntry));
  });

  /** Bir şovun bölümleri (feed taramasından birikir). */
  router.get('/v1/catalog/shows/:slug/episodes', async ctx => {
    const slug = ctx.params.slug;
    const limit = Math.min(
      MAX_EPISODES,
      Number(ctx.query.get('limit') ?? 50) || 50,
    );

    const rows = await service(ctx).select<EpisodeRow>(
      'episodes',
      'select=guid,title,description,audio_url,image_url,duration_sec,published_at' +
        `&show_slug=eq.${encodeURIComponent(slug)}` +
        `&order=published_at.desc.nullslast&limit=${limit}`,
    );

    return ok(
      rows.map(row => ({
        id: row.guid,
        showId: slug,
        title: row.title,
        description: row.description ?? '',
        audioUrl: row.audio_url,
        imageUrl: row.image_url ?? undefined,
        durationSec: row.duration_sec ?? 0,
        publishedAt: row.published_at ?? '',
      })),
    );
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
   * Eski uç — geriye dönük uyumluluk.
   *
   * İlk kurulumda ya da gömülü listeden geçişte tüm katalogu bir kerede
   * aktarmak için durur. Gönderilen şovlar yazılır; LİSTEDE OLMAYANLAR
   * silinmez (yanlış bir istek katalogu boşaltmasın).
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

/** Katalog kullanıcıya ait değildir → servis kimliği (RLS'e tabi değil). */
const service = (ctx: Ctx): SupabaseScope => Supabase.from(ctx.env).asService();

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
