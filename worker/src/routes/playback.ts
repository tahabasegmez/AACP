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

    const rows = await Supabase.from(ctx.env)
      .asUser(session.accessToken)
      .rpc<DeviceRow[]>('claim_playback', {
        p_device_id: deviceId,
        p_name: (body.name?.trim() || 'Cihaz').slice(0, MAX_NAME),
        p_platform: body.platform === 'ios' || body.platform === 'android'
          ? body.platform
          : 'unknown',
      });

    return ok({ devices: (rows ?? []).map(toDevice) });
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
