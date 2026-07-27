import { HttpError } from '../errors';
import { requireAdmin } from '../auth';
import { Supabase } from '../supabase';
import { ok, type Ctx } from '../router';

/** Kataloğun tek satırlık saklandığı ayar anahtarı. */
const CATALOG_KEY = 'catalog';

export interface CatalogEntry {
  readonly slug: string;
  readonly feedUrl: string;
  readonly title: string;
  readonly imageUrl?: string;
  readonly description?: string;
}

/**
 * Katalog uçları — şov listesini uygulama güncellemesi olmadan yönetir.
 *
 * Okuma herkese açıktır (kimlik gerekmez): katalog gizli veri değildir ve
 * uygulama ilk açılışta oturum açmadan da listeyi görebilmelidir. Yazma
 * `ADMIN_TOKEN` ile korunur.
 *
 * Katalog `settings` tablosunda tek bir JSON satırı olarak durur; şov sayısı
 * küçük olduğu için ayrı tablo ve sorgu karmaşıklığı gereksizdir.
 */
export const registerCatalogRoutes = (router: {
  get: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  router.get('/v1/catalog', async ctx => {
    const supabase = Supabase.from(ctx.env);
    // Servis kimliği: katalog kullanıcıya ait değildir, RLS'e tabi değil.
    const rows = await supabase
      .asService()
      .select<{ value: string }>('settings', `select=value&key=eq.${CATALOG_KEY}`);

    const raw = rows[0]?.value;
    if (!raw) {
      // Yayınlanmamışsa boş dizi döner; uygulama koda gömülü listeye düşer.
      return ok([]);
    }
    return ok(JSON.parse(raw));
  });

  router.post('/v1/catalog', async ctx => {
    requireAdmin(ctx);
    const entries = assertCatalog(ctx.body);

    const supabase = Supabase.from(ctx.env);
    await supabase
      .asService()
      .upsert('settings', [{ key: CATALOG_KEY, value: JSON.stringify(entries) }], 'key');

    return ok({ count: entries.length });
  });
};

/**
 * Katalog gövdesini doğrular.
 *
 * BOŞ DİZİ REDDEDİLİR: yanlış bir deploy'un tüm şovları gizlemesini önler.
 * Bir şovu kaldırmak için listeden çıkarın ama listeyi hiç boş bırakmayın.
 * Eksik alanlı tek tek girişler sessizce atlanır — bir bozuk kayıt tüm
 * yayını düşürmemeli.
 */
const assertCatalog = (body: unknown): CatalogEntry[] => {
  if (!Array.isArray(body)) {
    throw HttpError.badRequest('Gövde bir dizi olmalı');
  }
  const entries = body.filter((raw): raw is CatalogEntry => {
    const entry = raw as Partial<CatalogEntry>;
    return (
      typeof entry?.slug === 'string' &&
      typeof entry.feedUrl === 'string' &&
      typeof entry.title === 'string' &&
      entry.slug.length > 0 &&
      entry.feedUrl.length > 0
    );
  });
  if (entries.length === 0) {
    throw HttpError.badRequest('Katalog boş olamaz (en az bir geçerli şov gerekli)');
  }
  return entries;
};
