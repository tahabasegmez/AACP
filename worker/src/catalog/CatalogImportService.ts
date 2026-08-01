import type { Env } from '../env';
import { Supabase } from '../supabase';
import { FeedImporter, type ImportedShow } from './FeedImporter';
import { TransistorDiscovery } from './TransistorDiscovery';

export interface ImportResult {
  /** Kataloğa yazılan şovlar. */
  readonly imported: string[];
  /** Çözülemeyen adresler (diğerlerini etkilemez). */
  readonly failed: string[];
  /** Adresler nereden geldi? */
  readonly source: 'transistor' | 'request';
}

/**
 * CatalogImportService — katalogu KENDİLİĞİNDEN doldurur.
 *
 * İki kaynak, aynı akış:
 *   1. adres verilmezse yayıncı hesabındaki şovlar keşfedilir (Transistor),
 *   2. adres verilirse yalnızca onlar aktarılır.
 *
 * Her adresin RSS'i çekilir ve şov bilgisi FEED'İN KENDİSİNDEN okunur; başlık,
 * açıklama, kapak ve kategoriler elle girilmez. Yayıncı bir şeyi değiştirdiğinde
 * katalog bir sonraki aktarımda kendiliğinden düzelir.
 *
 * `active` ve `sort_order` yazılmaz: bunlar YÖNETİM kararlarıdır ve otomatik
 * aktarım, yayından kaldırılmış bir şovu geri açmamalı ya da elle verilmiş
 * sırayı bozmamalıdır.
 */
export class CatalogImportService {
  private readonly importer = new FeedImporter();

  constructor(private readonly env: Env) {}

  async run(feedUrls?: readonly string[]): Promise<ImportResult> {
    const explicit = (feedUrls ?? []).filter(url => url.trim().length > 0);
    const source = explicit.length > 0 ? 'request' : 'transistor';
    const urls =
      explicit.length > 0
        ? explicit
        : await new TransistorDiscovery(this.env).feedUrls();

    const { shows, failed } = await this.importer.importMany(urls);
    await this.save(shows);

    return { imported: shows.map(show => show.slug), failed, source };
  }

  /** Şovları kataloğa yazar (varsa günceller). */
  private async save(shows: readonly ImportedShow[]): Promise<void> {
    if (shows.length === 0) {
      return;
    }
    // Katalog kullanıcıya ait değildir → servis kimliği.
    await Supabase.from(this.env)
      .asService()
      .upsert('shows', shows.map(toRow), 'slug');
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
