import { HttpError } from '../errors';
import { requireSession } from '../auth';
import {
  EMPTY_SESSION,
  type PlaybackSession,
  type PlaybackSessionStore,
  type SessionDevice,
  resolvePlaybackSessionStore,
} from '../playback/PlaybackSessionStore';
import { Supabase } from '../supabase';
import { ok, type Ctx } from '../router';

/** `playback_devices` satırı (kalıcı cihaz listesi). */
interface DeviceRow {
  readonly device_id: string;
  readonly name: string;
  readonly platform: string;
  readonly last_seen_at: string;
}

/** Cihaz adı için üst sınır — liste satırını taşırmasın. */
const MAX_NAME = 60;

/**
 * `lastSeenAt` bu süreden eskiyse tazelenir.
 *
 * Her turda yazmak, oturumu her 5 saniyede bir diske itmek olurdu; oysa "son
 * görülme" dakika hassasiyetinde bir bilgidir. Yazma yalnızca gerçekten bir
 * şey değiştiğinde (komut, yayın) ya da bu süre dolduğunda yapılır.
 */
const TOUCH_INTERVAL_MS = 60_000;

/**
 * Oynatma oturumu uçları — bir hesapta AYNI ANDA TEK cihaz çalar.
 *
 * Oturumun DURUMU (kim aktif, ne çalıyor, bekleyen komut) Redis'te, TTL ile
 * yaşar; kalıcı cihaz listesi Postgres'tedir. Ayrımın sebebi ömür: durum
 * saniyeler içinde eskir ve kaybolması zararsızdır, liste ise kullanıcıya
 * gösterilen kalıcı bir kayıttır.
 *
 * Erişim daima kullanıcının kendi jetonuyla yapılır.
 */
export const registerPlaybackRoutes = (router: {
  get: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  /**
   * Oturumu devral ya da tazele.
   *
   * Devralınan cihazın O AN ÇALDIĞI da döner: devralan cihaz oradan devam
   * eder. Kendi yerel kaydından devam etmek, çoğu zaman başka bir bölümü
   * başka bir saniyeden çalmaktı.
   */
  router.post('/v1/playback/claim', async ctx => {
    const auth = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { deviceId?: string; name?: string; platform?: string };
    const deviceId = requireDeviceId(body.deviceId);

    const store = resolvePlaybackSessionStore(ctx.env, auth.accessToken);
    const session = await loadSession(ctx, auth, store);

    // Devralınan cihazın yayını, devralan için tek kaynaktır — pasifleştirmeden
    // ÖNCE okunur.
    const takenFrom =
      session.activeDeviceId && session.activeDeviceId !== deviceId
        ? session.nowPlaying
        : null;

    const device: SessionDevice = {
      name: (body.name?.trim() || 'Cihaz').slice(0, MAX_NAME),
      platform: normalizePlatform(body.platform),
      lastSeenAt: new Date().toISOString(),
    };

    const next: PlaybackSession = {
      ...session,
      activeDeviceId: deviceId,
      devices: { ...session.devices, [deviceId]: device },
      // Devralan cihaz kendi yayınını ilk turunda gönderecek; eskisini
      // taşımak, iki cihazın karıştığı bir ara durum bırakırdı.
      nowPlaying: null,
      command: null,
    };
    await store.write(auth.userId, next);

    // Kalıcı liste yalnızca BURADA yazılır (oynatma başına bir kez), turlarda
    // değil. Postgres'e yükü bu ayrım kaldırır.
    ctx.waitUntil(saveDeviceRow(ctx, auth, deviceId, device).catch(() => undefined));

    return ok({ devices: toDeviceList(next), nowPlaying: withAge(takenFrom) });
  });

  /** Oturumu bırakır (duraklatma/çıkış). Cihaz kaydı ve son yayın korunur. */
  router.post('/v1/playback/release', async ctx => {
    const auth = await requireSession(ctx);
    const deviceId = requireDeviceId(((ctx.body ?? {}) as { deviceId?: string }).deviceId);

    const store = resolvePlaybackSessionStore(ctx.env, auth.accessToken);
    const session = await store.read(auth.userId);

    // Aktif olmayan bir cihazın bırakması boş iştir; yazmadan dönülür.
    if (session?.activeDeviceId === deviceId) {
      await store.write(auth.userId, { ...session, activeDeviceId: null });
    }
    return ok({ released: true });
  });

  /**
   * Oynatmayı BAŞKA bir cihaza aktar.
   *
   * Hedef cihaz aktif olur ve komutu kendi turunda alır. Kaynak cihaza ayrıca
   * "dur" gönderilmez: kendi turunda oturumu kaybettiğini görüp duraklar —
   * durdurma kuralı tek yerde kalır.
   */
  router.post('/v1/playback/transfer', async ctx => {
    const auth = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { toDeviceId?: string; command?: unknown };

    const toDeviceId = body.toDeviceId?.trim();
    if (!toDeviceId) {
      throw HttpError.badRequest('toDeviceId gerekli');
    }
    if (!body.command || typeof body.command !== 'object') {
      throw HttpError.badRequest('command gerekli');
    }

    const store = resolvePlaybackSessionStore(ctx.env, auth.accessToken);
    const session = await loadSession(ctx, auth, store);
    if (!session.devices[toDeviceId]) {
      throw HttpError.badRequest('Cihaz bulunamadı');
    }

    const next: PlaybackSession = {
      ...session,
      activeDeviceId: toDeviceId,
      command: { toDeviceId, payload: body.command },
      // Hedef çalmaya başlayınca kendi yayınını gönderecek.
      nowPlaying: null,
    };
    await store.write(auth.userId, next);

    return ok({ devices: toDeviceList(next) });
  });

  /**
   * Cihazın turu — yayınla, komutunu al, listeyi al.
   *
   * Üçü tek çağrıda yapılır: her turda üçü de gerekir, ayrı uçlara bölmek
   * istek sayısını üçe katlardı. Komut OKUNDUĞUNDA SİLİNİR (gelen kutusu
   * mantığı), bu yüzden uç POST'tur.
   *
   * YAZMA, gerçekten bir şey değiştiyse yapılır: turların çoğu tek okumadır.
   */
  router.post('/v1/playback/poll', async ctx => {
    const auth = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { deviceId?: string; nowPlaying?: unknown };
    const deviceId = requireDeviceId(body.deviceId);

    const store = resolvePlaybackSessionStore(ctx.env, auth.accessToken);
    const session = await loadSession(ctx, auth, store);

    const mine = session.command?.toDeviceId === deviceId ? session.command : null;
    const isActive = session.activeDeviceId === deviceId;
    // Yayın yalnızca AKTİF cihazdan kabul edilir: duraklamış bir cihazın
    // konumu, devralacak cihaz için yanıltıcı olurdu.
    const publishing = isActive && !!body.nowPlaying && typeof body.nowPlaying === 'object';

    const device = session.devices[deviceId];
    const stale =
      !device || Date.now() - Date.parse(device.lastSeenAt) > TOUCH_INTERVAL_MS;

    if (mine || publishing || stale) {
      await store.write(auth.userId, {
        ...session,
        command: mine ? null : session.command,
        nowPlaying: publishing
          ? { payload: body.nowPlaying, atMs: Date.now() }
          : session.nowPlaying,
        devices: device
          ? { ...session.devices, [deviceId]: { ...device, lastSeenAt: new Date().toISOString() } }
          : session.devices,
      });
    }

    return ok({
      devices: toDeviceList(session),
      // Aktarılan komut EKSTRAPOLE EDİLMEZ: kaynak cihaz komutu gönderirken
      // zaten susmuştu, aradan geçen süre dinlenmiş sayılmaz.
      command: mine?.payload ?? null,
      // Devralma için olan yayın ise yaşıyla birlikte gider.
      nowPlaying: withAge(session.nowPlaying),
    });
  });

  /** Hesabın cihazları ve hangisinin çaldığı (salt okunur). */
  router.get('/v1/playback/devices', async ctx => {
    const auth = await requireSession(ctx);
    const store = resolvePlaybackSessionStore(ctx.env, auth.accessToken);
    return ok({ devices: toDeviceList(await loadSession(ctx, auth, store)) });
  });
};

/** İstek bağlamındaki oturum bilgisi (yalnızca kullanılan alanlar). */
type AuthSession = { readonly userId: string; readonly accessToken: string };

const requireDeviceId = (value?: string): string => {
  const deviceId = value?.trim();
  if (!deviceId) {
    throw HttpError.badRequest('deviceId gerekli');
  }
  return deviceId;
};

const normalizePlatform = (value?: string): string =>
  value === 'ios' || value === 'android' ? value : 'unknown';

/**
 * Oturumu okur; yoksa kalıcı listeden yeniden kurar.
 *
 * TTL dolduğunda cihaz listesi kaybolmamalı: kullanıcı "cihazlarım" ekranında
 * boş liste görmemeli. Aktif cihaz ve yayın ise bilinçli olarak kaybolur —
 * iki dakikadır ses gelmiyorsa kimse çalmıyordur.
 */
const loadSession = async (
  ctx: Ctx,
  auth: AuthSession,
  store: PlaybackSessionStore,
): Promise<PlaybackSession> => {
  const session = await store.read(auth.userId);
  if (session) {
    return session;
  }

  const rows = await Supabase.from(ctx.env)
    .asUser(auth.accessToken)
    .select<DeviceRow>(
      'playback_devices',
      'select=device_id,name,platform,last_seen_at&order=last_seen_at.desc',
    );

  return {
    ...EMPTY_SESSION,
    devices: Object.fromEntries(
      rows.map(row => [
        row.device_id,
        { name: row.name, platform: row.platform, lastSeenAt: row.last_seen_at },
      ]),
    ),
  };
};

/** Cihazı kalıcı listeye yazar (oynatma başına bir kez). */
const saveDeviceRow = async (
  ctx: Ctx,
  auth: AuthSession,
  deviceId: string,
  device: SessionDevice,
): Promise<void> => {
  await Supabase.from(ctx.env)
    .asUser(auth.accessToken)
    .upsert(
      'playback_devices',
      [
        {
          user_id: auth.userId,
          device_id: deviceId,
          name: device.name,
          platform: device.platform,
          last_seen_at: device.lastSeenAt,
        },
      ],
      'user_id,device_id',
    );
};

/** Oturumu istemcinin gördüğü cihaz listesine çevirir. */
const toDeviceList = (session: PlaybackSession) =>
  Object.entries(session.devices)
    .map(([id, device]) => ({
      id,
      name: device.name,
      platform: device.platform,
      active: session.activeDeviceId === id,
      lastSeenAt: device.lastSeenAt,
    }))
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));

/**
 * Yayına YAŞINI ekler.
 *
 * Konumu istemci `positionSec + yaş` ile ilerletir. Yaşı sunucu hesaplar:
 * damgayı gönderip istemciye çıkarttırmak, cihaz saatleri kaymışsa yanlış
 * saniyeden başlamak demekti.
 */
const withAge = (nowPlaying: { payload: unknown; atMs: number } | null): unknown => {
  if (!nowPlaying) {
    return null;
  }
  const payload = nowPlaying.payload as Record<string, unknown>;
  return { ...payload, ageMs: Math.max(0, Date.now() - nowPlaying.atMs) };
};
