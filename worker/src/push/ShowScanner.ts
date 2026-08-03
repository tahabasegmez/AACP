import type { Env } from '../env';
import { Supabase, type SupabaseScope } from '../supabase';
import { ApnsSender, type PushMessage } from './ApnsSender';
import { fetchFeed, type FeedValidators } from './FeedFetcher';
import { SCAN_LIMIT, parseEpisodes, type FeedEpisode } from './feedEpisodes';

/** Bir şovun en son görülen bölümünün saklandığı ayar anahtarı. */
const lastSeenKey = (slug: string): string => `push.lastSeen.${slug}`;

/** Tek upsert isteğinde taşınacak en fazla satır — gövde sınırına dayanmasın. */
const UPSERT_CHUNK = 500;

/** Taranacak şovun tarama için gereken alanları. */
export interface ScannableShow {
  readonly slug: string;
  readonly feedUrl: string;
  readonly title: string;
  readonly validators: FeedValidators;
}

export interface ScanOutcome {
  readonly slug: string;
  /** Feed değişmemiş — hiçbir iş yapılmadı. */
  readonly unchanged: boolean;
  readonly ingested: number;
  readonly notified: number;
  readonly failed?: string;
}

/**
 * ShowScanner — TEK bir şovu tarar.
 *
 * Sorumluluğu bilinçli olarak tek şovla sınırlıdır: kaç şovun, hangi sırayla
 * ve nereden (cron mu, kuyruk mu) tarandığı bu sınıfın meselesi değildir.
 * Bu ayrım sayesinde tarama, şov sayısından bağımsız olarak paralelleştirilebilir.
 *
 * Akış:
 *   1. feed'i KOŞULLU indir — değişmemişse burada biter,
 *   2. bölümleri çöz ve veritabanına işle,
 *   3. en son bölüm değiştiyse takipçilere bildirim gönder,
 *   4. doğrulayıcıları bir sonraki tur için sakla.
 *
 * İlk görülmede bildirim GÖNDERİLMEZ; yalnızca mevcut durum kaydedilir. Aksi
 * halde yeni eklenen bir şov, tüm arşivi için bildirim yağdırırdı.
 */
export class ShowScanner {
  private readonly apns: ApnsSender;

  constructor(private readonly env: Env) {
    this.apns = new ApnsSender(env);
  }

  /**
   * @param backfill Tüm arşivi işle. Rutin turda KULLANILMAZ ve koşullu
   *   isteği de atlar — arşiv doldurma, feed değişmemiş olsa bile gövdeyi ister.
   */
  async scan(show: ScannableShow, backfill = false): Promise<ScanOutcome> {
    const scope = Supabase.from(this.env).asService();
    const base = { slug: show.slug, unchanged: false, ingested: 0, notified: 0 };

    const result = await fetchFeed(show.feedUrl, backfill ? {} : show.validators);

    if (result.status === 'failed') {
      await this.recordFailure(scope, show.slug);
      return { ...base, failed: result.reason };
    }
    if (result.status === 'unchanged') {
      await this.recordChecked(scope, show.slug, show.validators);
      return { ...base, unchanged: true };
    }

    const episodes = parseEpisodes(
      result.xml,
      backfill ? Number.POSITIVE_INFINITY : SCAN_LIMIT,
    );
    const latest = episodes[0];
    if (!latest) {
      await this.recordChecked(scope, show.slug, result.validators);
      return base;
    }

    // Bölümler her taramada veritabanına işlenir: feed zaten indirildi,
    // ikinci bir iş çalıştırmak gereksiz.
    await this.ingest(scope, show.slug, episodes);

    const notified = await this.notifyIfNew(scope, show, latest);
    await this.recordChecked(scope, show.slug, result.validators);

    return { ...base, ingested: episodes.length, notified };
  }

  /** En son bölüm değiştiyse takipçilere bildirim gönderir. */
  private async notifyIfNew(
    scope: SupabaseScope,
    show: ScannableShow,
    latest: FeedEpisode,
  ): Promise<number> {
    const key = lastSeenKey(show.slug);
    const rows = await scope.select<{ value: string }>(
      'settings',
      `select=value&key=eq.${encodeURIComponent(key)}`,
    );
    const seen = rows[0]?.value;

    if (seen === latest.id) {
      return 0;
    }
    if (seen === undefined) {
      // İlk kez görülüyor: durumu kaydet ama bildirim gönderme.
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
   * Bölümleri veritabanına yazar (aynı guid tekrar gelirse günceller).
   *
   * Parçalar hâlinde gönderilir: bir arşiv doldurmasında tek istek binlerce
   * satır taşıyabilir ve gövde sınırına dayanabilirdi.
   */
  private async ingest(
    scope: SupabaseScope,
    slug: string,
    episodes: readonly FeedEpisode[],
  ): Promise<void> {
    for (let start = 0; start < episodes.length; start += UPSERT_CHUNK) {
      await scope.upsert(
        'episodes',
        episodes.slice(start, start + UPSERT_CHUNK).map(episode => ({
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

  /** Başarılı kontrolü ve doğrulayıcıları saklar. */
  private async recordChecked(
    scope: SupabaseScope,
    slug: string,
    validators: FeedValidators,
  ): Promise<void> {
    await scope
      .upsert(
        'shows',
        [
          {
            slug,
            feed_etag: validators.etag ?? null,
            feed_modified: validators.lastModified ?? null,
            feed_checked_at: new Date().toISOString(),
            feed_failures: 0,
          },
        ],
        'slug',
      )
      .catch(() => undefined);
  }

  /**
   * Başarısız denemeyi sayar.
   *
   * Sayaç doğrulayıcılara DOKUNMAZ: geçici bir ağ hatası yüzünden ETag'i
   * silmek, bir sonraki turu gereksiz yere koşulsuz yapardı.
   */
  private async recordFailure(scope: SupabaseScope, slug: string): Promise<void> {
    const rows = await scope
      .select<{ feed_failures: number }>(
        'shows',
        `select=feed_failures&slug=eq.${encodeURIComponent(slug)}&limit=1`,
      )
      .catch(() => []);

    await scope
      .upsert('shows', [{ slug, feed_failures: (rows[0]?.feed_failures ?? 0) + 1 }], 'slug')
      .catch(() => undefined);
  }
}
