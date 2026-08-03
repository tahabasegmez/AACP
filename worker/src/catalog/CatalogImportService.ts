import type { Env } from '../env';
import { Supabase, type SupabaseScope } from '../supabase';
import { FeedImporter, type ImportedShow } from './FeedImporter';

export interface ImportResult {
  /** Kataloğa yazılan şovlar. */
  readonly imported: string[];
  /** Çözülemeyen adresler (diğerlerini etkilemez). */
  readonly failed: string[];
  /** Adresler nereden geldi? */
  readonly source: 'catalog' | 'request';
}

/**
 * CatalogImportService — şov bilgisini RSS'ten okuyup kataloğa yazar.
 *
 * İki çağrı biçimi, aynı akış:
 *   1. adres verilirse o feed'ler aktarılır (yeni şov eklemenin yolu),
 *   2. adres verilmezse KATALOGDAKİ şovların adresleri tazelenir.
 *
 * İkincisi cron'un işidir: yayıncı kapağı ya da açıklamayı değiştirdiğinde
 * katalog kendiliğinden düzelir. Yeni şovun katalogda belirmesi ise BİLİNÇLİ
 * bir karardır — barındırıcıya özel bir keşif API'sine bağlanmak yerine feed
 * adresi açıkça verilir; RSS her sağlayıcıda çalışan ortak arayüzdür.
 *
 * Şov bilgisi FEED'İN KENDİSİNDEN okunur; başlık, açıklama, kapak ve
 * kategoriler elle girilmez.
 *
 * `active` ve `sort_order` yazılmaz: bunlar YÖNETİM kararlarıdır ve otomatik
 * aktarım, yayından kaldırılmış bir şovu geri açmamalı ya da elle verilmiş
 * sırayı bozmamalıdır.
 */
export class CatalogImportService {
  private readonly importer = new FeedImporter();

  constructor(private readonly env: Env) {}

  async run(feedUrls?: readonly string[]): Promise<ImportResult> {
    // Katalog kullanıcıya ait değildir → servis kimliği.
    const scope = Supabase.from(this.env).asService();

    const explicit = (feedUrls ?? []).filter(url => url.trim().length > 0);
    const source = explicit.length > 0 ? 'request' : 'catalog';
    const urls = explicit.length > 0 ? explicit : await this.catalogFeedUrls(scope);

    const { shows, failed } = await this.importer.importMany(urls);
    await this.save(scope, shows);

    return { imported: shows.map(show => show.slug), failed, source };
  }

  /** Katalogdaki yayında olan şovların feed adresleri (tazeleme turu için). */
  private async catalogFeedUrls(scope: SupabaseScope): Promise<string[]> {
    const rows = await scope.select<{ feed_url: string }>(
      'shows',
      'select=feed_url&active=is.true',
    );
    return rows.map(row => row.feed_url);
  }

  /** Şovları kataloğa yazar (varsa günceller). */
  private async save(scope: SupabaseScope, shows: readonly ImportedShow[]): Promise<void> {
    if (shows.length === 0) {
      return;
    }
    await scope.upsert('shows', shows.map(toRow), 'slug');
  }
}

/**
 * Şovu `shows` satırına çevirir.
 *
 * `active` ve `sort_order` BİLİNÇLİ olarak yok: upsert yalnızca gönderilen
 * sütunları günceller, dolayısıyla mevcut satırın yönetim alanları korunur ve
 * ilk eklemede tablo varsayılanları geçerli olur.
 */
const toRow = (show: ImportedShow): Record<string, unknown> => ({
  slug: show.slug,
  feed_url: show.feedUrl,
  title: show.title,
  description: show.description ?? null,
  image_url: show.imageUrl ?? null,
  author: show.author ?? null,
  language: show.language ?? null,
  categories: show.categories,
  updated_at: new Date().toISOString(),
});
