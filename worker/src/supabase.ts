import { HttpError } from './errors';
import type { Env } from './env';

/**
 * Supabase erişimi — bağımlılıksız, doğrudan REST.
 *
 * `@supabase/supabase-js` yerine `fetch` kullanılır: Workers bundle'ı küçük
 * kalır ve bağımlılık yüzeyi daralır. İhtiyacımız olan yüzey zaten dar
 * (birkaç tablo okuma/yazma + auth uçları).
 *
 * İKİ KİMLİK MODU vardır ve bu ayrım güvenliğin temelidir:
 *
 *  - `asUser(token)`: kullanıcının kendi jetonuyla çalışır. Postgres RLS
 *    devreye girer ve kullanıcı YALNIZCA kendi satırlarını görebilir. Kullanıcı
 *    verisine (senkron, telemetri) erişim daima bu modda yapılır.
 *
 *  - `asService()`: servis anahtarıyla çalışır ve RLS'i BYPASS eder. Yalnızca
 *    kullanıcıya ait olmayan yönetim işleri (katalog yayınlama, feed tarama,
 *    push hedefi bulma) için kullanılır.
 */
export class Supabase {
  constructor(
    private readonly url: string,
    private readonly anonKey: string,
    private readonly serviceKey: string,
  ) {}

  static from(env: Env): Supabase {
    if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
      throw HttpError.internal('Supabase yapılandırılmamış');
    }
    return new Supabase(
      env.SUPABASE_URL.replace(/\/+$/, ''),
      env.SUPABASE_ANON_KEY,
      env.SUPABASE_SERVICE_KEY ?? '',
    );
  }

  /** Kullanıcının jetonuyla veri erişimi — RLS geçerlidir. */
  asUser(accessToken: string): SupabaseScope {
    return new SupabaseScope(this.url, this.anonKey, accessToken);
  }

  /** Servis anahtarıyla veri erişimi — RLS BYPASS edilir (yönetim işleri). */
  asService(): SupabaseScope {
    if (!this.serviceKey) {
      throw HttpError.internal('Servis anahtarı yapılandırılmamış');
    }
    return new SupabaseScope(this.url, this.serviceKey, this.serviceKey);
  }

  // --- Auth (GoTrue) ------------------------------------------------------

  /** Auth ucuna istek atar; hatayı kullanıcıya gösterilebilir mesaja çevirir. */
  async auth<T>(path: string, body: unknown, accessToken?: string): Promise<T> {
    const response = await fetch(`${this.url}/auth/v1${path}`, {
      method: 'POST',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(body),
    });
    return readAuthResponse<T>(response);
  }

  /** Oturumdaki kullanıcının Supabase profili. */
  async authUser<T>(accessToken: string): Promise<T> {
    const response = await fetch(`${this.url}/auth/v1/user`, {
      headers: { apikey: this.anonKey, Authorization: `Bearer ${accessToken}` },
    });
    return readAuthResponse<T>(response);
  }

  /**
   * Dosyayı GENEL bir kovaya yükler ve okunabilir adresini döner.
   *
   * Servis anahtarıyla yazılır: kova genel okumaya açıktır ama yazma yalnızca
   * sunucudan yapılır — istemcinin başkasının yoluna dosya koyabilmesi kabul
   * edilemez. Aynı yola tekrar yazma `x-upsert` ile serbesttir.
   */
  async uploadPublic(
    bucket: string,
    path: string,
    body: ArrayBuffer,
    contentType: string,
  ): Promise<string> {
    if (!this.serviceKey) {
      throw HttpError.internal('Servis anahtarı yapılandırılmamış');
    }

    const response = await fetch(`${this.url}/storage/v1/object/${bucket}/${path}`, {
      method: 'POST',
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      // Depo, eksik kovayı HTTP 400 ile bildirir ve 404'ü GÖVDEYE koyar; bu
      // yüzden durum koduna değil hata koduna bakılır. Kurulum adımı
      // atlanmışsa mesaj bunu açıkça söylemelidir.
      if (text.includes('NoSuchBucket')) {
        throw HttpError.internal(
          `"${bucket}" kovası yok — worker/supabase/schema-03-avatars.sql çalıştırılmalı`,
        );
      }
      throw HttpError.internal(`Yükleme başarısız (${response.status}): ${text.slice(0, 200)}`);
    }

    return `${this.url}/storage/v1/object/public/${bucket}/${path}`;
  }

  /** Kullanıcı profilini günceller (ad, meta veri). */
  async updateAuthUser<T>(accessToken: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.url}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        apikey: this.anonKey,
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });
    return readAuthResponse<T>(response);
  }
}

/** Belirli bir kimlikle (kullanıcı ya da servis) veri erişimi. */
export class SupabaseScope {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly token: string,
  ) {}

  /** Tablodan kayıt okur. `query` PostgREST sorgu dizesidir. */
  async select<T>(table: string, query: string): Promise<T[]> {
    const response = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
      headers: this.headers(),
    });
    return this.read<T[]>(response);
  }

  /**
   * Kayıt ekler/günceller. `onConflict` verilirse UPSERT yapılır.
   * Yanıt gövdesi istenmez (`return=minimal`) — ağ trafiği gereksiz büyümesin.
   */
  async upsert(table: string, rows: readonly unknown[], onConflict?: string): Promise<void> {
    if (rows.length === 0) {
      return;
    }
    const query = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const response = await fetch(`${this.url}/rest/v1/${table}${query}`, {
      method: 'POST',
      headers: {
        ...this.headers(),
        'Content-Type': 'application/json',
        Prefer: onConflict ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
      },
      body: JSON.stringify(rows),
    });
    await this.read<void>(response);
  }

  /** Kayıt siler. `query` PostgREST filtresidir (ör. `token=eq.abc`). */
  async remove(table: string, query: string): Promise<void> {
    const response = await fetch(`${this.url}/rest/v1/${table}?${query}`, {
      method: 'DELETE',
      headers: { ...this.headers(), Prefer: 'return=minimal' },
    });
    await this.read<void>(response);
  }

  private headers(): Record<string, string> {
    return { apikey: this.apiKey, Authorization: `Bearer ${this.token}` };
  }

  /** Yanıtı çözer; PostgREST hatalarını HttpError'a çevirir. */
  private async read<T>(response: Response): Promise<T> {
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      if (response.status === 401 || response.status === 403) {
        throw HttpError.unauthorized('Bu veriye erişim yetkiniz yok');
      }
      throw HttpError.internal(`Veritabanı hatası (${response.status}): ${text.slice(0, 200)}`);
    }
    if (response.status === 204) {
      return undefined as T;
    }
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }
}

/** GoTrue yanıtını çözer; hata mesajını kullanıcıya uygun hale getirir. */
const readAuthResponse = async <T>(response: Response): Promise<T> => {
  const text = await response.text();
  const parsed = text ? (JSON.parse(text) as Record<string, unknown>) : {};

  if (!response.ok) {
    const message =
      (parsed.error_description as string) ??
      (parsed.msg as string) ??
      (parsed.message as string) ??
      'Kimlik işlemi başarısız';
    if (response.status === 400 || response.status === 422) {
      throw HttpError.badRequest(message);
    }
    if (response.status === 401 || response.status === 403) {
      throw HttpError.unauthorized(message);
    }
    // Supabase'in e-posta/oturum oran sınırları. Sunucu hatası DEĞİLDİR:
    // kullanıcıya "biraz sonra tekrar dene" demek doğru davranıştır.
    if (response.status === 429) {
      throw HttpError.tooManyRequests(
        message === 'email rate limit exceeded'
          ? 'E-posta gönderim sınırına ulaşıldı, birazdan tekrar deneyin'
          : message,
      );
    }
    throw HttpError.internal(message);
  }
  return parsed as T;
};
