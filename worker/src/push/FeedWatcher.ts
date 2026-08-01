import type { Env } from '../env';
import type { CatalogEntry } from '../routes/catalog';
import { Supabase, type SupabaseScope } from '../supabase';
import { readAttribute, readTag } from '../xml';
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

  /** Yayındaki şovlar — katalog artık kendi tablosunda. */
  private async loadCatalog(scope: SupabaseScope): Promise<CatalogEntry[]> {
    const rows = await scope.select<{ slug: string; feed_url: string; title: string }>(
      'shows',
      'select=slug,feed_url,title&active=is.true',
    );
    return rows.map(row => ({
      slug: row.slug,
      feedUrl: row.feed_url,
      title: row.title,
    }));
  }

  /** Tek bir şovu kontrol eder; gönderilen bildirim sayısını döner. */
  private async checkShow(scope: SupabaseScope, show: CatalogEntry): Promise<number> {
    const episodes = await this.fetchEpisodes(show.feedUrl);
    const latest = episodes[0];
    if (!latest) {
      return 0;
    }

    // Bölümler her taramada veritabanına işlenir: feed zaten indirildi,
    // ikinci bir iş çalıştırmak gereksiz. Böylece bölüm listesi sunucuda da
    // bulunur (arama, "yeni bölümler", ileride istemciye sunma).
    await this.ingestEpisodes(scope, show.slug, episodes).catch(() => undefined);

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
   * Takipler `show_follows` tablosundan okunur: senkron kayıtları oraya
   * izdüşürülür (bkz. schema-02) ve böylece "bu şovu kimler takip ediyor"
   * sorusu tombstone filtrelemeden, indeksli bir sorguyla yanıtlanır.
   */
  private async followersOf(scope: SupabaseScope, showId: string): Promise<string[]> {
    const follows = await scope.select<{ user_id: string }>(
      'show_follows',
      `select=user_id&show_slug=eq.${encodeURIComponent(showId)}`,
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
   * Feed'in bölümlerini çözer (en yeniden eskiye, feed sırasıyla).
   *
   * Tam bir XML ayrıştırıcı yerine hedefli okuma yapılır: Worker bundle'ına
   * XML bağımlılığı eklememek için `<item>` blokları düz metin olarak taranır.
   * İhtiyacımız olan alan kümesi dar ve RSS'te bu alanların biçimi sabittir.
   */
  private async fetchEpisodes(feedUrl: string): Promise<FeedEpisode[]> {
    const response = await fetch(feedUrl, {
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return [];
    }
    return parseEpisodes(await response.text());
  }

  /** Bölümleri veritabanına yazar (aynı guid tekrar gelirse günceller). */
  private async ingestEpisodes(
    scope: SupabaseScope,
    slug: string,
    episodes: readonly FeedEpisode[],
  ): Promise<void> {
    if (episodes.length === 0) {
      return;
    }
    await scope.upsert(
      'episodes',
      episodes.map(episode => ({
        show_slug: slug,
        guid: episode.id,
        title: episode.title,
        description: episode.description ?? null,
        audio_url: episode.audioUrl,
        image_url: episode.imageUrl ?? null,
        duration_sec: episode.durationSec ?? null,
        published_at: episode.publishedAt ?? null,
      })),
      'show_slug,guid',
    );
  }
}

/** Feed'den okunan tek bölüm. */
interface FeedEpisode {
  readonly id: string;
  readonly title: string;
  readonly description?: string;
  readonly audioUrl: string;
  readonly imageUrl?: string;
  readonly durationSec?: number;
  readonly publishedAt?: string;
}

/** Tek taramada işlenecek en fazla bölüm — cron penceresi kilitlenmesin. */
const MAX_ITEMS = 100;

/**
 * RSS gövdesinden bölümleri okur (saf fonksiyon — ayrı test edilir).
 *
 * Ses dosyası (`enclosure`) olmayan öğeler ATLANIR: çalınamayan bir kayıt
 * bölüm listesinde yer tutmamalı.
 */
export const parseEpisodes = (xml: string): FeedEpisode[] => {
  const episodes: FeedEpisode[] = [];
  let cursor = 0;

  while (episodes.length < MAX_ITEMS) {
    const start = xml.indexOf('<item', cursor);
    if (start === -1) {
      break;
    }
    const end = xml.indexOf('</item>', start);
    const item = xml.slice(start, end === -1 ? undefined : end);
    cursor = end === -1 ? xml.length : end + 7;

    const audioUrl = readAttribute(item, 'enclosure', 'url');
    if (!audioUrl) {
      continue;
    }
    const id = readTag(item, 'guid') ?? audioUrl;

    episodes.push({
      id,
      title: readTag(item, 'title') ?? 'İsimsiz bölüm',
      description: readTag(item, 'description'),
      audioUrl,
      imageUrl: readAttribute(item, 'itunes:image', 'href'),
      durationSec: parseDuration(readTag(item, 'itunes:duration')),
      publishedAt: parseDate(readTag(item, 'pubDate')),
    });

    if (end === -1) {
      break;
    }
  }

  return episodes;
};

/** `HH:MM:SS`, `MM:SS` ya da saniye — saniyeye çevirir. */
const parseDuration = (value: string | undefined): number | undefined => {
  if (!value) {
    return undefined;
  }
  const parts = value.split(':').map(Number);
  if (parts.some(Number.isNaN)) {
    return undefined;
  }
  return parts.reduce((total, part) => total * 60 + part, 0);
};

/** RFC 822 tarihini ISO'ya çevirir; çözülemezse alan boş bırakılır. */
const parseDate = (value: string | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
};

