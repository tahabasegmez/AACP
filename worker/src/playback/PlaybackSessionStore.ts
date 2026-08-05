import type { Env } from '../env';
import { HttpRedisClient } from '../storage/HttpRedisClient';
import { Supabase } from '../supabase';

/**
 * Oturumun yaşam süresi.
 *
 * Oynatma oturumu KENDİNİ TEMİZLEYEN bir veridir: cihaz çökerse, uçağa
 * binerse ya da uygulama öldürülürse kimse `release` çağırmaz. TTL bu yüzden
 * kilit değil zaman aşımıdır — iki dakika sonra "kimse çalmıyor" durumuna
 * dönülür ve takılı kalmış bir "aktif cihaz" diye bir şey olmaz.
 *
 * Turlar 5-10 saniyede bir geldiği için çalan bir cihazın anahtarı hiç
 * düşmez; süre yalnızca GERÇEKTEN kaybolmuş cihazlar için işler.
 */
const SESSION_TTL_SEC = 120;

/** Bir cihazın kalıcı kaydı (ad/platform). */
export interface SessionDevice {
  readonly name: string;
  readonly platform: string;
  readonly lastSeenAt: string;
}

/**
 * PlaybackSession — hesabın oynatma oturumunun TAMAMI, tek nesne.
 *
 * Tek anahtarda tutulur: her tur yalnızca bir okuma yapar ve parçaların
 * birbiriyle tutarsız kalması (aktif cihaz A, çalan bölüm B'nin) mümkün olmaz.
 */
export interface PlaybackSession {
  /** Şu an çalan cihaz; kimse çalmıyorsa null. */
  readonly activeDeviceId: string | null;
  /** Aktif cihazın yayınladığı "ne çalıyorum" bilgisi. */
  readonly nowPlaying: NowPlaying | null;
  /** Bir cihaza bırakılmış "şunu çal" komutu. */
  readonly command: PendingCommand | null;
  /** Cihaz listesi (kimlik → kayıt). */
  readonly devices: Record<string, SessionDevice>;
}

/** Yayınlanan oynatma durumu; `atMs` sunucu saatiyle damgalanır. */
export interface NowPlaying {
  readonly payload: unknown;
  /** Yayının sunucu saatine göre zamanı — yaş hesabı bununla yapılır. */
  readonly atMs: number;
}

export interface PendingCommand {
  readonly toDeviceId: string;
  readonly payload: unknown;
}

export const EMPTY_SESSION: PlaybackSession = {
  activeDeviceId: null,
  nowPlaying: null,
  command: null,
  devices: {},
};

/**
 * PlaybackSessionStore — oturumun okunup yazıldığı yer.
 *
 * Port arkasında durmasının sebebi, bu verinin doğru evinin zamanla
 * değişecek olması: bugün Redis, yarın kalıcı bağlantı (Durable Object).
 * Rotalar hangisi olduğunu bilmez.
 */
export interface PlaybackSessionStore {
  read(userId: string): Promise<PlaybackSession | null>;
  write(userId: string, session: PlaybackSession): Promise<void>;
}

/**
 * Redis deposu — asıl yol.
 *
 * Tek `GET`, gerektiğinde tek `SET EX`. Atomiklik ARANMAZ: kural bir kilit
 * değil devralmadır ve çakışan tek senaryo aynı insanın iki cihazda aynı anda
 * düğmeye basmasıdır — o durumda bile bir sonraki tur durumu düzeltir. Lua ya
 * da WATCH/MULTI eklemek, olmayan bir soruna karmaşıklık olurdu.
 */
class RedisPlaybackSessionStore implements PlaybackSessionStore {
  constructor(private readonly redis: HttpRedisClient) {}

  private key(userId: string): string {
    return `pb:session:${userId}`;
  }

  async read(userId: string): Promise<PlaybackSession | null> {
    const [raw] = await this.redis.pipeline([['GET', this.key(userId)]]);
    if (typeof raw !== 'string' || !raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as PlaybackSession;
    } catch {
      // Bozuk kayıt oturumu kilitlememeli; yokmuş gibi davranılır.
      return null;
    }
  }

  async write(userId: string, session: PlaybackSession): Promise<void> {
    await this.redis.pipeline([
      ['SET', this.key(userId), JSON.stringify(session), 'EX', String(SESSION_TTL_SEC)],
    ]);
  }
}

/**
 * Postgres yedeği — Redis yapılandırılmamış kurulumlar için.
 *
 * Kullanıcı başına tek satır; yani bir anahtar-değer deposunun taklidi.
 * Cloudflare KV bilinçli olarak KULLANILMAZ: 60 saniyeye varan eventual
 * consistency, "kim çalıyor" sorusunu yanlış cevaplardı.
 */
class PostgresPlaybackSessionStore implements PlaybackSessionStore {
  constructor(
    private readonly env: Env,
    private readonly accessToken: string,
  ) {}

  async read(userId: string): Promise<PlaybackSession | null> {
    const rows = await Supabase.from(this.env)
      .asUser(this.accessToken)
      .select<{ data?: PlaybackSession; updated_at?: string }>(
        'playback_sessions',
        `user_id=eq.${userId}&select=data,updated_at&limit=1`,
      );

    const row = rows[0];
    if (!row?.data) {
      return null;
    }
    // TTL'i Postgres'te bir iş (cron) ile temizlemek yerine okurken uygulanır:
    // eskimiş oturum yok sayılır, satır bir sonraki yazımda üzerine yazılır.
    const age = Date.now() - Date.parse(row.updated_at ?? '');
    return Number.isFinite(age) && age > SESSION_TTL_SEC * 1000 ? null : row.data;
  }

  async write(userId: string, session: PlaybackSession): Promise<void> {
    await Supabase.from(this.env)
      .asUser(this.accessToken)
      .upsert(
        'playback_sessions',
        [{ user_id: userId, data: session, updated_at: new Date().toISOString() }],
        'user_id',
      );
  }
}

/** Oturum deposunu çözer — Redis varsa o, yoksa Postgres. */
export const resolvePlaybackSessionStore = (
  env: Env,
  accessToken: string,
): PlaybackSessionStore =>
  env.REDIS_URL && env.REDIS_TOKEN
    ? new RedisPlaybackSessionStore(new HttpRedisClient(env.REDIS_URL, env.REDIS_TOKEN))
    : new PostgresPlaybackSessionStore(env, accessToken);
