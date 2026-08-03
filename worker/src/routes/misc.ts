import { HttpError } from '../errors';
import { optionalSession, requireSession } from '../auth';
import { analyticsEnabled } from '../env';
import { Supabase } from '../supabase';
import { noContent, ok, type Ctx } from '../router';

/** Tek istekte kabul edilen en fazla olay. */
const MAX_EVENTS = 200;

interface AnalyticsEvent {
  readonly name: string;
  readonly occurredAt: number;
  readonly payload?: unknown;
}

/**
 * Telemetri ve push kaydı uçları.
 *
 * İkisi de küçük olduğu için tek dosyada toplanmıştır; ayrı modüllere bölmek
 * gezinmeyi zorlaştırırdı.
 */
export const registerMiscRoutes = (router: {
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  // --- telemetri ---------------------------------------------------------
  /**
   * Olayları toplu kaydeder. Oturum ZORUNLU DEĞİLDİR: oturum açılmadan önceki
   * açılış olayları da anlamlıdır (kullanıcısız kaydedilir).
   */
  router.post('/v1/analytics', async ctx => {
    if (!analyticsEnabled(ctx.env)) {
      return ok({ accepted: 0, disabled: true });
    }
    const events = assertEvents(ctx.body);
    if (events.length === 0) {
      return ok({ accepted: 0 });
    }

    const session = await optionalSession(ctx);
    const supabase = Supabase.from(ctx.env);
    // Telemetri yazımı servis kimliğiyle yapılır: kullanıcı kendi olaylarını
    // OKUYAMAZ (RLS ile yalnızca yazma izni verilirdi), yönetim raporlaması
    // için tek yerde toplanır.
    const scope = supabase.asService();

    const rows = events.map(event => ({
      user_id: session?.userId ?? null,
      name: event.name,
      payload: JSON.stringify(event.payload ?? {}),
      occurred_at: event.occurredAt,
    }));

    // Yanıtı bekletmeden yaz: telemetri hiçbir zaman istemciyi yavaşlatmamalı.
    ctx.waitUntil(scope.upsert('analytics_events', rows).catch(() => undefined));
    return ok({ accepted: rows.length });
  });

  // --- push kaydı --------------------------------------------------------
  router.post('/v1/push/register', async ctx => {
    const session = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { token?: string; platform?: string };
    const token = body.token?.trim();
    if (!token) {
      throw HttpError.badRequest('token gerekli');
    }

    const supabase = Supabase.from(ctx.env);
    await supabase.asUser(session.accessToken).upsert(
      'push_registrations',
      [
        {
          token,
          user_id: session.userId,
          platform: body.platform === 'android' ? 'android' : 'ios',
          updated_at: Date.now(),
        },
      ],
      'token',
    );
    return ok({ registered: true });
  });

  router.post('/v1/push/unregister', async ctx => {
    const session = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { token?: string };
    if (!body.token) {
      throw HttpError.badRequest('token gerekli');
    }
    const supabase = Supabase.from(ctx.env);
    await supabase
      .asUser(session.accessToken)
      .remove('push_registrations', `token=eq.${encodeURIComponent(body.token)}`);
    return noContent();
  });

};

const assertEvents = (body: unknown): AnalyticsEvent[] => {
  const events = (body as { events?: unknown })?.events;
  if (!Array.isArray(events)) {
    throw HttpError.badRequest('events bir dizi olmalı');
  }
  if (events.length > MAX_EVENTS) {
    throw HttpError.badRequest(`En fazla ${MAX_EVENTS} olay gönderilebilir`);
  }
  // Bozuk olaylar sessizce atlanır — telemetri hiçbir zaman akışı bozmamalı.
  return events.filter((raw): raw is AnalyticsEvent => {
    const event = raw as Partial<AnalyticsEvent>;
    return (
      typeof event?.name === 'string' &&
      event.name.length > 0 &&
      typeof event.occurredAt === 'number'
    );
  });
};
