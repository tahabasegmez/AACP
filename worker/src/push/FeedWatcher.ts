import type { Env } from '../env';
import type { CatalogEntry } from '../routes/catalog';
import { Supabase, type SupabaseScope } from '../supabase';
import { ApnsSender, type PushMessage } from './ApnsSender';

/** Bir şovun en son görülen bölümünün saklandığı ayar anahtarı. */
const lastSeenKey = (slug: string): string => `push.lastSeen.${slug}`;
/** Feed çekme zaman aşımı — cron penceresini kilitlemesin. */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * FeedWatcher — takip edilen şovlarda yeni bölüm çıkınca bildirim gönderir.
 *
 * Akış (şov başına):
 *   1. RSS feed'ini çek, EN SON bölümün kimliğini oku,
 *   2. daha önce görülenle karşılaştır — değişmemişse hiçbir şey yapma,
 *   3. yeni ise o şovu TAKİP EDEN kullanıcıların push jetonlarını bul,
 *   4. bildirimleri gönder ve yeni kimliği "görüldü" olarak kaydet.
 *
 * İlk çalıştırmada bildirim GÖNDERİLMEZ; yalnızca mevcut durum kaydedilir.
 * Aksi halde servis ilk açılışta tüm katalog için bildirim yağdırırdı.
 *
 * Cloudflare Cron Trigger tarafından çağrılır (bkz. wrangler.toml `[triggers]`).
 */
export class FeedWatcher {
  private readonly apns: ApnsSender;

  constructor(private readonly env: Env) {
    this.apns = new ApnsSender(env);
  }

  async runOnce(): Promise<{ checked: number; notified: number }> {
    const supabase = Supabase.from(this.env);
    // Tarama kullanıcıya ait olmayan bir yönetim işidir → servis kimliği.
    const scope = supabase.asService();

    const shows = await this.loadCatalog(scope);
    let notified = 0;

    for (const show of shows) {
      try {
        notified += await this.checkShow(scope, show);
      } catch {
        // Bir şovdaki hata diğerlerini etkilemez.
      }
    }
    return { checked: shows.length, notified };
  }

  private async loadCatalog(scope: SupabaseScope): Promise<CatalogEntry[]> {
    const rows = await scope.select<{ value: string }>(
      'settings',
      'select=value&key=eq.catalog',
    );
    if (!rows[0]?.value) {
      return [];
    }
    try {
      const parsed = JSON.parse(rows[0].value) as CatalogEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Tek bir şovu kontrol eder; gönderilen bildirim sayısını döner. */
  private async checkShow(scope: SupabaseScope, show: CatalogEntry): Promise<number> {
    const latest = await this.fetchLatestEpisode(show.feedUrl);
    if (!latest) {
      return 0;
    }

    const key = lastSeenKey(show.slug);
    const rows = await scope.select<{ value: string }>(
      'settings',
      `select=value&key=eq.${encodeURIComponent(key)}`,
    );
    const seen = rows[0]?.value;

    if (seen === latest.id) {
      return 0; // değişiklik yok
    }

    // İlk kez görülüyor: durumu kaydet ama bildirim gönderme.
    if (seen === undefined) {
      await scope.upsert('settings', [{ key, value: latest.id }], 'key');
      return 0;
    }

    const targets = await this.followersOf(scope, show.slug);
    if (targets.length > 0 && this.apns.enabled) {
      const messages: PushMessage[] = targets.map(token => ({
        token,
        title: show.title,
        body: `Yeni bölüm: ${latest.title}`,
        data: { showId: show.slug, episodeId: latest.id },
      }));
      const result = await this.apns.send(messages);

      // Geçersiz jetonların kaydı düşürülür.
      for (const token of result.invalidTokens) {
        await scope
          .remove('push_registrations', `token=eq.${encodeURIComponent(token)}`)
          .catch(() => undefined);
      }
    }

    await scope.upsert('settings', [{ key, value: latest.id }], 'key');
    return targets.length;
  }

  /**
   * Şovu takip eden kullanıcıların push jetonları.
   *
   * Takip kaydı `sync_records` içinde `collection='follows'`, `key=showId`
   * olarak durur; silinmiş (tombstone) kayıtlar hariç tutulur. İki sorgu
   * yapılır çünkü PostgREST gömülü join için tablolar arası ilişki tanımı
   * ister; iki basit sorgu burada daha anlaşılır ve yeterince hızlıdır.
   */
  private async followersOf(scope: SupabaseScope, showId: string): Promise<string[]> {
    const follows = await scope.select<{ user_id: string }>(
      'sync_records',
      `select=user_id&collection=eq.follows&key=eq.${encodeURIComponent(showId)}&deleted=is.false`,
    );
    if (follows.length === 0) {
      return [];
    }

    const userIds = [...new Set(follows.map(f => f.user_id))];
    const registrations = await scope.select<{ token: string }>(
      'push_registrations',
      `select=token&user_id=in.(${userIds.map(id => `"${id}"`).join(',')})`,
    );
    return registrations.map(r => r.token);
  }

  /**
   * Feed'in EN SON bölümünü çözer.
   *
   * Tam bir XML ayrıştırıcı yerine hedefli okuma yapılır: yalnızca ilk `<item>`
   * bloğundan kimlik ve başlık alınır. Amaç "bir şey değişti mi?" sorusuna
   * cevap vermek olduğu için bu yeterlidir ve Worker'a XML bağımlılığı eklemez.
   */
  private async fetchLatestEpisode(
    feedUrl: string,
  ): Promise<{ id: string; title: string } | undefined> {
    const response = await fetch(feedUrl, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return undefined;
    }
    const xml = await response.text();

    const itemStart = xml.indexOf('<item');
    if (itemStart === -1) {
      return undefined;
    }
    const itemEnd = xml.indexOf('</item>', itemStart);
    const item = xml.slice(itemStart, itemEnd === -1 ? undefined : itemEnd);

    const title = readTag(item, 'title') ?? 'Yeni bölüm';
    const id =
      readTag(item, 'guid') ??
      readAttribute(item, 'enclosure', 'url') ??
      readTag(item, 'pubDate');

    return id ? { id, title } : undefined;
  }
}

/** `<tag>değer</tag>` içeriğini okur (CDATA dahil). */
const readTag = (xml: string, tag: string): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(xml);
  if (!match) {
    return undefined;
  }
  const value = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
  return value.length > 0 ? value : undefined;
};

/** `<tag attr="değer" .../>` özniteliğini okur. */
const readAttribute = (xml: string, tag: string, attribute: string): string | undefined => {
  const match = new RegExp(`<${tag}[^>]*\\b${attribute}=["']([^"']+)["']`, 'i').exec(xml);
  return match?.[1];
};
