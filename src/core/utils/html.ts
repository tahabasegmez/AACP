/**
 * stripHtml — RSS açıklamalarındaki HTML etiketlerini temizleyip düz metin döner.
 * Bölüm notları ve şov açıklamaları gibi CDATA/HTML içerikleri göstermek için.
 */
export const stripHtml = (html: string): string =>
  html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
