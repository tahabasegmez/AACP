import type { Env } from '../env';

/** Transistor API kök adresi (v1). */
const DEFAULT_BASE_URL = 'https://api.transistor.fm/v1';
/** Sayfa boyutu ve emniyet sınırı — kontrolsüz döngü olmasın. */
const PAGE_SIZE = 50;
const MAX_PAGES = 20;

interface TransistorShow {
  readonly attributes?: {
    readonly feed_url?: string;
    readonly slug?: string;
  };
}

/**
 * TransistorDiscovery — yayıncı hesabındaki şovları KENDİLİĞİNDEN bulur.
 *
 * Katalogu doldurmanın en az emek isteyen yolu: hangi şovların olduğunu
 * yayıncının kendi hesabı zaten biliyor. Elle adres listesi tutmak, yeni bir
 * şov açıldığında kimsenin haberi olmaması demekti.
 *
 * API anahtarı yoksa boş liste döner ve aktarım "verilen adresler" moduna
 * düşer — eksik yapılandırma hata değil, yalnızca daha az otomasyondur.
 */
export class TransistorDiscovery {
  constructor(private readonly env: Env) {}

  get enabled(): boolean {
    return Boolean(this.env.TRANSISTOR_API_KEY);
  }

  /** Hesaptaki tüm şovların feed adresleri. */
  async feedUrls(): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }

    const base = (this.env.TRANSISTOR_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    const urls: string[] = [];

    for (let page = 1; page <= MAX_PAGES; page++) {
      const response = await fetch(
        `${base}/shows?pagination[page]=${page}&pagination[per]=${PAGE_SIZE}`,
        {
          headers: {
            Accept: 'application/json',
            'x-api-key': this.env.TRANSISTOR_API_KEY ?? '',
          },
        },
      );
      if (!response.ok) {
        break;
      }

      const body = (await response.json()) as { data?: TransistorShow[] };
      const items = body.data ?? [];
      urls.push(
        ...items
          .map(item => item.attributes?.feed_url)
          .filter((url): url is string => !!url),
      );

      // Son sayfa: dolmamış bir sayfa geldiyse devamı yok.
      if (items.length < PAGE_SIZE) {
        break;
      }
    }

    return [...new Set(urls)];
  }
}
