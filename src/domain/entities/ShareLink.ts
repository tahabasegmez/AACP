/**
 * Paylaşım ve derin bağlantı adresleri.
 *
 * Uygulama içinden paylaşılan her bağlantı bir **https** adresidir, özel şema
 * (`aacp://`) DEĞİL. Sebebi: özel şema yalnızca uygulama kuruluysa çalışır;
 * kurulu değilse bağlantı tarayıcıda hiçbir şey açmaz ve kullanıcı ne
 * paylaşıldığını göremez. https adresi her yerde açılır, uygulama kuruluysa
 * ona yönlenir, değilse tanıtım sayfasını gösterir.
 *
 * Adres biçimi kısa ve okunabilir tutulur; kimlikler zaten URL güvenli
 * değildir (RSS guid'leri her şey olabilir), bu yüzden kodlanır.
 */

/** Paylaşılabilen içerik türleri. */
export type ShareTarget =
  | { readonly kind: 'episode'; readonly showId: string; readonly episodeId: string }
  | { readonly kind: 'show'; readonly showId: string };

/** Uygulamanın kendi şeması — kurulu uygulamayı doğrudan açar. */
export const APP_URL_SCHEME = 'aacp';

/**
 * Paylaşılacak https adresini kurar.
 *
 * @param baseUrl Bağlantıların sunulduğu kök (worker adresi).
 */
export const shareUrl = (baseUrl: string, target: ShareTarget): string => {
  const root = baseUrl.replace(/\/+$/, '');
  return target.kind === 'episode'
    ? `${root}/s/e/${encodeURIComponent(target.showId)}/${encodeURIComponent(target.episodeId)}`
    : `${root}/s/p/${encodeURIComponent(target.showId)}`;
};

/**
 * Gelen bir derin bağlantıyı çözer.
 *
 * Hem https adresini hem özel şemayı (`aacp://e/<show>/<episode>`) kabul eder:
 * biri paylaşımdan, diğeri tanıtım sayfasının yönlendirmesinden gelir ve
 * ikisinin de aynı yere düşmesi gerekir.
 *
 * Tanınmayan adres `null` döner — uygulama açılır ama hiçbir yere gitmez;
 * bozuk bir bağlantı yüzünden hata ekranı göstermek gereksizdir.
 */
export const parseShareUrl = (url: string): ShareTarget | null => {
  const path = extractPath(url);
  if (!path) {
    return null;
  }
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

  // `/s/e/<show>/<episode>` ya da özel şemada `e/<show>/<episode>`
  const at = parts[0] === 's' ? 1 : 0;
  const kind = parts[at];
  if (kind === 'e' && parts[at + 1] && parts[at + 2]) {
    return { kind: 'episode', showId: parts[at + 1], episodeId: parts[at + 2] };
  }
  if (kind === 'p' && parts[at + 1]) {
    return { kind: 'show', showId: parts[at + 1] };
  }
  return null;
};

/** Adresin şema ve konak kısmını atıp yolu döner. */
const extractPath = (url: string): string | null => {
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  // `aacp://e/...` biçiminde konak yoktur; `//` sonrası doğrudan yoldur.
  const schemeEnd = trimmed.indexOf('://');
  if (schemeEnd === -1) {
    return trimmed;
  }
  const rest = trimmed.slice(schemeEnd + 3);
  if (trimmed.startsWith(`${APP_URL_SCHEME}://`)) {
    return rest;
  }
  const slash = rest.indexOf('/');
  return slash === -1 ? '' : rest.slice(slash + 1);
};
