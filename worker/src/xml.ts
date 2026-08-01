/**
 * RSS okuma yardımcıları — hedefli, bağımlılıksız.
 *
 * Worker bundle'ına bir XML ayrıştırıcı eklemek yerine `<tag>` blokları düz
 * metin olarak taranır. İhtiyacımız olan alan kümesi dar ve RSS'te bu alanların
 * biçimi sabittir; tam ayrıştırma soğuk başlatmayı ve bundle'ı büyütürdü.
 *
 * Saf fonksiyonlardır ve ayrı test edilir.
 */

/** `<tag>değer</tag>` içeriğini okur (CDATA dahil). */
export const readTag = (xml: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  if (!match) {
    return undefined;
  }
  const value = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  return value.length > 0 ? value : undefined;
};

/** `<tag attr="değer" .../>` özniteliğini okur. */
export const readAttribute = (
  xml: string,
  tag: string,
  attribute: string,
): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*\\b${attribute}=["']([^"']+)["']`, 'i').exec(xml);
  return match?.[1];
};

/**
 * Feed gövdesinin `<channel>` başlığını (öğeler hariç) döner.
 *
 * İlk `<item>`den öncesi alınır: aksi halde şovun başlığı yerine ilk bölümün
 * başlığı okunabilirdi — aynı etiket adları hem kanalda hem öğede geçer.
 */
export const channelHeader = (xml: string): string => {
  const start = xml.indexOf('<channel');
  const firstItem = xml.indexOf('<item', start === -1 ? 0 : start);
  return xml.slice(start === -1 ? 0 : start, firstItem === -1 ? undefined : firstItem);
};

/** Feed URL'inden kararlı bir şov kimliği (slug) üretir — istemcideki kuralla AYNI. */
export const slugFromFeedUrl = (feedUrl: string): string => {
  const cleaned = feedUrl.split('?')[0].replace(/\/+$/, '');
  const last = cleaned.substring(cleaned.lastIndexOf('/') + 1);
  return last || feedUrl;
};
