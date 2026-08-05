import { HttpError } from '../errors';
import { requireSession } from '../auth';
import { Supabase } from '../supabase';
import { ok, type Ctx } from '../router';

/** `playback_devices` satırı (fonksiyon dönüşü). */
interface DeviceRow {
  readonly device_id: string;
  readonly name: string;
  readonly platform: string;
  readonly active: boolean;
  readonly last_seen_at: string;
}

/** `claim_playback` dönüşü — liste + devralınan cihazın çaldığı bölüm. */
interface ClaimResult {
  readonly devices?: readonly DeviceRow[];
  readonly now_playing?: unknown;
}

/** `poll_playback` dönüşü — liste + bekleyen komut + aktif cihazın çaldığı. */
interface PollResult extends ClaimResult {
  readonly command?: unknown;
}

/** Cihaz adı için üst sınır — liste satırını taşırmasın. */
const MAX_NAME = 60;

/**
 * Oynatma oturumu uçları — bir hesapta AYNI ANDA TEK cihaz çalar.
 *
 * Kural veritabanında zorlanır (kısmi tekil indeks) ve devralma tek bir
 * fonksiyonda atomik yapılır; bu uçlar yalnızca onu çağırır. Mantığı buraya
 * taşımak, iki cihazın aynı anda talep etmesi durumunda ikisinin de
 * kazanabileceği bir pencere açardı.
 *
 * Erişim DAİMA kullanıcının kendi jetonuyla yapılır: `auth.uid()` fonksiyonun
 * içinde okunur, istemcinin verdiği bir kimliğe güvenilmez.
 */
export const registerPlaybackRoutes = (router: {
  get: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  /**
   * Oturumu devral ya da tazele.
   *
   * Oynatma başlarken ve çalarken periyodik olarak çağrılır; ikisi de aynı
   * işlemdir (idempotent). Yanıt, hesabın TÜM cihazlarını döner — istemci
   * böylece hem kazandığını hem listeyi tek istekte öğrenir.
   */
  router.post('/v1/playback/claim', async ctx => {
    const session = await requireSession(ctx);
    const body = (ctx.body ?? {}) as {
      deviceId?: string;
      name?: string;
      platform?: string;
    };

    const deviceId = body.deviceId?.trim();
    if (!deviceId) {
      throw HttpError.badRequest('deviceId gerekli');
    }

    const result = await Supabase.from(ctx.env)
      .asUser(session.accessToken)
      .rpc<ClaimResult>('claim_playback', {
        p_device_id: deviceId,
        p_name: (body.name?.trim() || 'Cihaz').slice(0, MAX_NAME),
        p_platform: body.platform === 'ios' || body.platform === 'android'
          ? body.platform
          : 'unknown',
      });

    return ok({
      devices: (result?.devices ?? []).map(toDevice),
      // Devralınan cihazın çaldığı bölüm — devralan cihaz oradan devam eder.
      nowPlaying: result?.now_playing ?? null,
    });
  });

  /** Oturumu bırakır (duraklatma/çıkış). Cihaz kaydı korunur. */
  router.post('/v1/playback/release', async ctx => {
    const session = await requireSession(ctx);
    const deviceId = ((ctx.body ?? {}) as { deviceId?: string }).deviceId?.trim();
    if (!deviceId) {
      throw HttpError.badRequest('deviceId gerekli');
    }

    await Supabase.from(ctx.env)
      .asUser(session.accessToken)
      .rpc<null>('release_playback', { p_device_id: deviceId });

    return ok({ released: true });
  });

  /**
   * Oynatmayı BAŞKA bir cihaza aktar.
   *
   * Hedef cihaz aktif yapılır ve ona ne çalacağını söyleyen bir komut bırakılır.
   * Kaynak cihaza ayrıca "dur" gönderilmez: kendi turunda oturumu kaybettiğini
   * görüp duraklar — durdurma kuralı tek yerde kalır.
   */
  router.post('/v1/playback/transfer', async ctx => {
    const session = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { toDeviceId?: string; command?: unknown };

    const toDeviceId = body.toDeviceId?.trim();
    if (!toDeviceId) {
      throw HttpError.badRequest('toDeviceId gerekli');
    }
    if (!body.command || typeof body.command !== 'object') {
      throw HttpError.badRequest('command gerekli');
    }

    const rows = await Supabase.from(ctx.env)
      .asUser(session.accessToken)
      .rpc<DeviceRow[]>('transfer_playback', {
        p_to_device_id: toDeviceId,
        p_command: body.command,
      });

    return ok({ devices: (rows ?? []).map(toDevice) });
  });

  /**
   * Cihazın turu — tazele, gelen kutusunu boşalt, listeyi al.
   *
   * Üçü tek çağrıda yapılır: her turda üçü de gerekir, ayrı uçlara bölmek
   * istek sayısını üçe katlardı. Komut OKUNDUĞUNDA SİLİNİR (gelen kutusu
   * mantığı), bu yüzden uç POST'tur.
   */
  router.post('/v1/playback/poll', async ctx => {
    const session = await requireSession(ctx);
    const deviceId = ((ctx.body ?? {}) as { deviceId?: string }).deviceId?.trim();
    if (!deviceId) {
      throw HttpError.badRequest('deviceId gerekli');
    }

    // Aktif cihaz her turda ne çaldığını YAYINLAR; başka bir cihaz oynatmayı
    // devraldığında bölümü ve saniyeyi buradan öğrenir.
    const nowPlaying = (ctx.body as { nowPlaying?: unknown } | undefined)?.nowPlaying;

    const result = await Supabase.from(ctx.env)
      .asUser(session.accessToken)
      .rpc<PollResult>('poll_playback', {
        p_device_id: deviceId,
        p_now_playing: nowPlaying && typeof nowPlaying === 'object' ? nowPlaying : null,
      });

    return ok({
      devices: (result?.devices ?? []).map(toDevice),
      command: result?.command ?? null,
      nowPlaying: result?.now_playing ?? null,
    });
  });

  /** Hesabın cihazları ve hangisinin çaldığı. */
  router.get('/v1/playback/devices', async ctx => {
    const session = await requireSession(ctx);

    const rows = await Supabase.from(ctx.env)
      .asUser(session.accessToken)
      .select<DeviceRow>(
        'playback_devices',
        'select=device_id,name,platform,active,last_seen_at&order=last_seen_at.desc',
      );

    return ok({ devices: rows.map(toDevice) });
  });
};

const toDevice = (row: DeviceRow) => ({
  id: row.device_id,
  name: row.name,
  platform: row.platform,
  active: row.active,
  lastSeenAt: row.last_seen_at,
});
