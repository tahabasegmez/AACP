/**
 * Feed'in KOŞULLU indirilmesi.
 *
 * Feed'lerin ezici çoğunluğu iki tarama turu arasında değişmez. Yayıncının
 * verdiği doğrulayıcılar (`ETag`, `Last-Modified`) bir sonraki istekte geri
 * gönderildiğinde sunucu 304 döner: gövde hiç aktarılmaz, ayrıştırma ve
 * veritabanı yazması yapılmaz.
 *
 * Kazanç, şov sayısıyla doğru orantılıdır — 5.000 şovun tamamını her yarım
 * saatte baştan indirmek ne cron penceresine ne yayıncının bant genişliğine
 * sığar.
 */

/** Feed çekme zaman aşımı — tek yavaş yayıncı turu kilitlemesin. */
const FETCH_TIMEOUT_MS = 10_000;

/** Saklanan doğrulayıcılar. */
export interface FeedValidators {
  readonly etag?: string;
  readonly lastModified?: string;
}

export type FeedFetchResult =
  /** İçerik değişmemiş — yapılacak iş yok. */
  | { readonly status: 'unchanged' }
  /** İçerik geldi; doğrulayıcılar bir sonraki tur için saklanmalı. */
  | { readonly status: 'ok'; readonly xml: string; readonly validators: FeedValidators }
  /** Çekilemedi (ağ hatası, 4xx/5xx). */
  | { readonly status: 'failed'; readonly reason: string };

/** Koşullu istek başlıklarını kurar. */
export const conditionalHeaders = (validators: FeedValidators): Record<string, string> => {
  const headers: Record<string, string> = {
    Accept: 'application/rss+xml, application/xml, text/xml',
  };
  // İkisi de gönderilir: yayıncıların bir kısmı yalnızca birini destekler.
  if (validators.etag) {
    headers['If-None-Match'] = validators.etag;
  }
  if (validators.lastModified) {
    headers['If-Modified-Since'] = validators.lastModified;
  }
  return headers;
};

/** Yanıttan bir sonraki tur için saklanacak doğrulayıcıları okur. */
export const readValidators = (headers: Headers): FeedValidators => ({
  etag: headers.get('etag') ?? undefined,
  lastModified: headers.get('last-modified') ?? undefined,
});

/** Feed'i koşullu olarak indirir. */
export const fetchFeed = async (
  feedUrl: string,
  validators: FeedValidators,
): Promise<FeedFetchResult> => {
  let response: Response;
  try {
    response = await fetch(feedUrl, {
      headers: conditionalHeaders(validators),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    return {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'ağ hatası',
    };
  }

  if (response.status === 304) {
    return { status: 'unchanged' };
  }
  if (!response.ok) {
    return { status: 'failed', reason: `HTTP ${response.status}` };
  }

  return {
    status: 'ok',
    xml: await response.text(),
    // Yeni doğrulayıcı gelmediyse eskisi korunur: yayıncı başlığı bu turda
    // vermediyse, elimizdekini atmak bir sonraki turu koşulsuz yapardı.
    validators: {
      etag: readValidators(response.headers).etag ?? validators.etag,
      lastModified: readValidators(response.headers).lastModified ?? validators.lastModified,
    },
  };
};
