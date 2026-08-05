import { ok, type Ctx, type Handler } from '../router';
import { Supabase } from '../supabase';

/** Uygulamanın kendi şeması — istemcideki `APP_URL_SCHEME` ile aynı olmalı. */
const APP_SCHEME = 'aacp';

/**
 * Paylaşım (derin bağlantı) sayfaları.
 *
 * Uygulamadan paylaşılan her bağlantı bir **https** adresidir; bu uç onu
 * karşılar ve şunu yapar:
 *
 *  1. Uygulama kuruluysa `aacp://…` şemasına yönlendirir (sayfa açılır açılmaz),
 *  2. Kurulu değilse içeriğin başlığını/kapağını gösteren küçük bir sayfa kalır.
 *
 * Neden sunucuda bir sayfa: özel şema, uygulama kurulu değilken hiçbir şey
 * açmaz — bağlantıyı alan kişi ne paylaşıldığını dahi göremezdi. Ayrıca
 * WhatsApp/X gibi uygulamalar önizlemeyi (`og:` etiketleri) yalnızca https
 * adresinden okur.
 *
 * Sayfa yalnızca HERKESE AÇIK katalog verisini gösterir; oturum gerektirmez.
 */
export const registerShareRoutes = (router: {
  get: (path: string, handler: Handler) => unknown;
}): void => {
  router.get('/s/e/:showId/:episodeId', async ctx =>
    sharePage(ctx, {
      deepLink: `${APP_SCHEME}://e/${encode(ctx.params.showId)}/${encode(ctx.params.episodeId)}`,
      ...(await episodeMeta(ctx)),
    }),
  );

  router.get('/s/p/:showId', async ctx =>
    sharePage(ctx, {
      deepLink: `${APP_SCHEME}://p/${encode(ctx.params.showId)}`,
      ...(await showMeta(ctx)),
    }),
  );

  // Sağlık kontrolü uçlarıyla aynı biçimde: paylaşım altyapısının ayakta
  // olduğunu, uygulamaya gitmeden doğrulamak için.
  router.get('/s/health', async () => ok({ status: 'ok', scheme: APP_SCHEME }));
};

/** Sayfanın göstereceği içerik. */
interface ShareMeta {
  readonly deepLink: string;
  readonly title: string;
  readonly description: string;
  readonly imageUrl?: string;
}

/** Bölüm başlığı/kapağı — bulunamazsa şovunkine, o da yoksa jenerik metne düşer. */
const episodeMeta = async (ctx: Ctx): Promise<Omit<ShareMeta, 'deepLink'>> => {
  const rows = await selectRows<{ title?: string; description?: string; image_url?: string }>(
    ctx,
    'episodes',
    // Bölüm kimliği (guid) feed'ler arasında benzersiz DEĞİLDİR; şov birlikte
    // sorgulanmalı — birincil anahtar (show_slug, guid) çiftidir.
    `show_slug=eq.${encodeURIComponent(ctx.params.showId)}` +
      `&guid=eq.${encodeURIComponent(ctx.params.episodeId)}` +
      '&select=title,description,image_url&limit=1',
  );
  const episode = rows[0];
  if (episode?.title) {
    return {
      title: episode.title,
      description: clip(episode.description) || 'Anadolu Ajansı Podcast',
      imageUrl: episode.image_url,
    };
  }
  return showMeta(ctx);
};

/** Şov başlığı/kapağı. */
const showMeta = async (ctx: Ctx): Promise<Omit<ShareMeta, 'deepLink'>> => {
  const rows = await selectRows<{ title?: string; description?: string; image_url?: string }>(
    ctx,
    'shows',
    `slug=eq.${encodeURIComponent(ctx.params.showId)}&select=title,description,image_url&limit=1`,
  );
  const show = rows[0];
  return {
    title: show?.title ?? 'Anadolu Ajansı Podcast',
    description: clip(show?.description) || 'Anadolu Ajansı Podcast',
    imageUrl: show?.image_url,
  };
};

/**
 * Katalogdan tek satır okur.
 *
 * Sunucu yapılandırılmamışsa ya da sorgu düşerse BOŞ döner: paylaşım sayfası
 * her koşulda açılmalı; başlık gösterememek, hata sayfası göstermekten iyidir.
 */
const selectRows = async <T>(ctx: Ctx, table: string, query: string): Promise<T[]> => {
  if (!ctx.env.SUPABASE_URL || !ctx.env.SUPABASE_ANON_KEY) {
    return [];
  }
  try {
    return await Supabase.from(ctx.env).asAnon().select<T>(table, query);
  } catch {
    return [];
  }
};

/** Açıklamayı önizleme için kısaltır (HTML etiketleri temizlenir). */
const clip = (text?: string): string => {
  const plain = (text ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  return plain.length > 200 ? `${plain.slice(0, 197)}…` : plain;
};

const encode = (value: string): string => encodeURIComponent(value);

/** HTML metin bağlamına güvenli yazım. */
const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Yönlendirme sayfası.
 *
 * Yönlendirme JavaScript ile yapılır, HTTP 302 ile DEĞİL: 302 ile özel şemaya
 * gitmek, uygulama kurulu değilken tarayıcıda hata diyaloğu çıkarır ve geri
 * dönülecek bir sayfa kalmaz. Bu sayfa ise açık kalır.
 */
const sharePage = (_ctx: Ctx, meta: ShareMeta): Response => {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const image = meta.imageUrl ? escapeHtml(meta.imageUrl) : '';
  const link = escapeHtml(meta.deepLink);

  const html = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — Anadolu Ajansı Podcast</title>
<meta property="og:title" content="${title}">
<meta property="og:description" content="${description}">
<meta property="og:type" content="music.song">
${image ? `<meta property="og:image" content="${image}">` : ''}
<meta name="twitter:card" content="summary_large_image">
<style>
  :root { color-scheme: light dark; }
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
         background:#0f0f10; color:#f5f5f7; padding:24px; }
  .card { max-width:420px; width:100%; text-align:center; }
  img { width:220px; height:220px; border-radius:16px; object-fit:cover; margin-bottom:24px; }
  h1 { font-size:22px; line-height:1.3; margin:0 0 8px; }
  p { font-size:15px; line-height:1.5; opacity:.72; margin:0 0 28px; }
  a.open { display:inline-block; padding:14px 28px; border-radius:999px; font-weight:600;
           text-decoration:none; background:#f5f5f7; color:#0f0f10; }
</style>
</head>
<body>
  <div class="card">
    ${image ? `<img src="${image}" alt="">` : ''}
    <h1>${title}</h1>
    <p>${description}</p>
    <a class="open" href="${link}">Uygulamada aç</a>
  </div>
  <script>
    // Uygulama kuruluysa hemen ona geç. Kurulu değilse hiçbir şey olmaz ve
    // yukarıdaki sayfa görünür kalır.
    location.href = ${JSON.stringify(meta.deepLink)};
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      // Katalog verisi seyrek değişir; önizleme botları da tekrar tekrar
      // sorgulamasın.
      'Cache-Control': 'public, max-age=300',
    },
  });
};
