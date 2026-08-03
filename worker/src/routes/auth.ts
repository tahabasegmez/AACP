import { HttpError } from '../errors';
import { requireSession } from '../auth';
import { avatarPath, decodeAvatar } from '../avatarImage';
import { Supabase } from '../supabase';
import { created, ok, type Ctx } from '../router';

/** Profil fotoğraflarının tutulduğu genel kova (bkz. schema-03). */
const AVATAR_BUCKET = 'avatars';

/** GoTrue oturum yanıtı. */
interface GoTrueSession {
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly expires_in?: number;
  readonly user?: GoTrueUser;
}

interface GoTrueUser {
  readonly id?: string;
  readonly email?: string;
  readonly created_at?: string;
  readonly is_anonymous?: boolean;
  readonly user_metadata?: {
    readonly display_name?: string;
    readonly avatar_url?: string;
  };
}

/**
 * Kimlik uçları — Supabase Auth'a (GoTrue) ince bir PROXY.
 *
 * İstemci doğrudan Supabase ile konuşmaz; yalnızca bu Worker'ı tanır. Böylece:
 *  - uygulamaya Supabase SDK'sı ve anon anahtarı gömmek gerekmez,
 *  - kimlik sağlayıcısı ileride değişirse istemci kodu etkilenmez,
 *  - yanıt şekli uygulamanın beklediği biçimde sabit kalır.
 *
 * Anonim kullanıcı Supabase'in "anonymous sign-in" özelliğiyle açılır; kişi
 * daha sonra hesap oluşturduğunda AYNI kullanıcı e-posta ile yükseltilir
 * (`updateAuthUser`), bu yüzden anonimken biriken veri hesaba taşınmaz —
 * zaten aynı kullanıcıya aittir.
 */

/** İstemcinin beklediği oturum şekli. */
const toSession = (session: GoTrueSession) => {
  if (!session.access_token || !session.user?.id) {
    throw HttpError.internal('Kimlik yanıtı beklenen alanları içermiyor');
  }
  return {
    token: session.access_token,
    refreshToken: session.refresh_token,
    userId: session.user.id,
    expiresInSec: session.expires_in ?? 3600,
    user: toUser(session.user),
  };
};

const toUser = (user: GoTrueUser) => ({
  id: user.id ?? '',
  // Anonim kullanıcıda e-posta yoktur — uygulama bunu "misafir" olarak yorumlar.
  email: user.email && user.email.length > 0 ? user.email : undefined,
  displayName: user.user_metadata?.display_name,
  avatarUrl: user.user_metadata?.avatar_url,
  createdAt: user.created_at ? Date.parse(user.created_at) : Date.now(),
});

export const registerAuthRoutes = (router: {
  get: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
  post: (p: string, h: (c: Ctx) => Promise<Response>) => unknown;
}): void => {
  /**
   * Anonim oturum. Cihaz kimliği artık gerekmez — Supabase kalıcı bir anonim
   * kullanıcı üretir ve istemci jetonu saklar.
   */
  router.post('/v1/auth/device', async ctx => {
    const supabase = Supabase.from(ctx.env);
    const session = await supabase.auth<GoTrueSession>('/signup', {});
    return created(toSession(session));
  });

  /**
   * Hesap oluşturma.
   *
   * İstek oturumlu geldiyse (kullanıcı anonim olarak kullanıyorduysa) yeni
   * kullanıcı YARATILMAZ; mevcut anonim kullanıcı e-posta/şifre ile yükseltilir.
   * Böylece dinleme geçmişi ve listeler hesaba doğal olarak geçer.
   */
  router.post('/v1/auth/register', async ctx => {
    const { email, password } = credentials(ctx);
    const supabase = Supabase.from(ctx.env);

    const existing = await optionalToken(ctx);
    if (existing) {
      const current = await supabase.authUser<GoTrueUser>(existing).catch(() => undefined);
      if (current?.is_anonymous) {
        await supabase.updateAuthUser<GoTrueUser>(existing, { email, password });
        // Yükseltmeden sonra jeton yenilenir ki yeni kimlik bilgileri yansısın.
        const refreshed = await supabase.auth<GoTrueSession>('/token?grant_type=password', {
          email,
          password,
        });
        return created(toSession(refreshed));
      }
    }

    const session = await supabase.auth<GoTrueSession>('/signup', { email, password });
    // E-posta doğrulaması açıksa signup jeton döndürmez; kullanıcı bilgilendirilir.
    if (!session.access_token) {
      return ok({ pendingEmailConfirmation: true });
    }
    return created(toSession(session));
  });

  /** E-posta + şifre ile giriş. */
  router.post('/v1/auth/login', async ctx => {
    const { email, password } = credentials(ctx);
    const supabase = Supabase.from(ctx.env);
    const session = await supabase.auth<GoTrueSession>('/token?grant_type=password', {
      email,
      password,
    });
    return ok(toSession(session));
  });

  /** Süresi dolan erişim jetonunu yeniler. */
  router.post('/v1/auth/refresh', async ctx => {
    const body = (ctx.body ?? {}) as { refreshToken?: string };
    if (!body.refreshToken) {
      throw HttpError.badRequest('refreshToken gerekli');
    }
    const supabase = Supabase.from(ctx.env);
    const session = await supabase.auth<GoTrueSession>('/token?grant_type=refresh_token', {
      refresh_token: body.refreshToken,
    });
    return ok(toSession(session));
  });

  /** Oturumdaki kullanıcının profili. */
  router.get('/v1/auth/me', async ctx => {
    const session = await requireSession(ctx);
    const supabase = Supabase.from(ctx.env);
    const user = await supabase.authUser<GoTrueUser>(session.accessToken);
    return ok(toUser(user));
  });

  /** Görünen adı günceller. */
  router.post('/v1/auth/profile', async ctx => {
    const session = await requireSession(ctx);
    const body = (ctx.body ?? {}) as { displayName?: string };
    const displayName = body.displayName?.trim();
    if (displayName !== undefined && displayName.length > 60) {
      throw HttpError.badRequest('Ad en fazla 60 karakter olabilir');
    }
    const supabase = Supabase.from(ctx.env);
    const user = await supabase.updateAuthUser<GoTrueUser>(session.accessToken, {
      data: { display_name: displayName },
    });
    return ok(toUser(user));
  });

  /**
   * Profil fotoğrafını yükler.
   *
   * Dosya GENEL bir kovaya sunucu kimliğiyle yazılır, adresi kullanıcının
   * meta verisine işlenir. Yolun başında kullanıcı kimliği vardır ve bu kimlik
   * JETONDAN okunur — istemcinin verdiği bir kimliğe güvenmek, herkesin
   * başkasının fotoğrafını değiştirebilmesi demekti.
   */
  router.post('/v1/auth/avatar', async ctx => {
    const session = await requireSession(ctx);
    const image = decodeAvatar(ctx.body);
    const supabase = Supabase.from(ctx.env);

    const url = await supabase.uploadPublic(
      AVATAR_BUCKET,
      avatarPath(session.userId, image.extension, Date.now()),
      image.bytes,
      image.contentType,
    );

    const user = await supabase.updateAuthUser<GoTrueUser>(session.accessToken, {
      data: { avatar_url: url },
    });
    return ok(toUser(user));
  });

  /** Şifre sıfırlama e-postası gönderir (Supabase Auth halleder). */
  router.post('/v1/auth/reset-password', async ctx => {
    const body = (ctx.body ?? {}) as { email?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email) {
      throw HttpError.badRequest('E-posta gerekli');
    }
    const supabase = Supabase.from(ctx.env);
    await supabase.auth('/recover', { email });
    // Hesabın var olup olmadığı sızmasın diye yanıt her durumda aynıdır.
    return ok({ sent: true });
  });
};

/** Gövdeden e-posta/şifre okur ve asgari doğrulamayı yapar. */
const credentials = (ctx: Ctx): { email: string; password: string } => {
  const body = (ctx.body ?? {}) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase() ?? '';
  const password = body.password ?? '';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw HttpError.badRequest('Geçerli bir e-posta girin');
  }
  if (password.length < 8) {
    throw HttpError.badRequest('Şifre en az 8 karakter olmalı');
  }
  return { email, password };
};

/** Varsa geçerli jetonu döner (yükseltme akışı için). */
const optionalToken = async (ctx: Ctx): Promise<string | undefined> => {
  try {
    return (await requireSession(ctx)).accessToken;
  } catch {
    return undefined;
  }
};
