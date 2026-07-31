import type { KvNamespace } from './storage/KvSyncStore';

/**
 * Env — Cloudflare Workers'a bağlanan ayarlar ve gizli değerler.
 *
 * `wrangler.toml` içindeki `[vars]` gizli OLMAYAN ayarlardır; anahtarlar
 * `wrangler secret put <AD>` ile eklenir ve koda hiç girmez.
 *
 * Gizli değer verilmemişse ilgili özellik sessizce kapanır (ör. APNs anahtarı
 * yoksa bildirim gönderilmez). Böylece eksik yapılandırma servisi düşürmez.
 */
export interface Env {
  // --- Supabase ---------------------------------------------------------
  /** Proje adresi, ör. https://xxxx.supabase.co */
  readonly SUPABASE_URL: string;
  /** Herkese açık anon anahtarı — kullanıcı jetonuyla birlikte RLS altında kullanılır. */
  readonly SUPABASE_ANON_KEY: string;
  /** Servis anahtarı — YALNIZCA yönetim işleri (katalog, feed tarama) için. */
  readonly SUPABASE_SERVICE_KEY: string;
  /** Kullanıcı jetonlarını yerel doğrulamak için JWT gizli anahtarı. */
  readonly SUPABASE_JWT_SECRET: string;

  // --- NoSQL (Cloudflare KV) --------------------------------------------
  /**
   * Yüksek hacimli, ilişkisiz kullanıcı durumu (kaldığın yer, tercihler).
   *
   * BAĞLANMAMIŞSA ilgili koleksiyonlar Postgres'e düşer: eksik yapılandırma
   * servisi düşürmez, yalnızca yerleşim değişir (bkz. resolveStore).
   */
  readonly USER_STATE?: KvNamespace;

  // --- Yönetim ----------------------------------------------------------
  /** Katalog yayınlama gibi uçları korur. Boşsa bu uçlar KAPALIDIR. */
  readonly ADMIN_TOKEN?: string;

  // --- Özellik ayarları -------------------------------------------------
  readonly ANALYTICS_ENABLED?: string;
  readonly CORS_ORIGINS?: string;

  // --- Transistor (opsiyonel proxy) -------------------------------------
  readonly TRANSISTOR_BASE_URL?: string;
  readonly TRANSISTOR_API_KEY?: string;

  // --- APNs (iOS bildirimleri) ------------------------------------------
  /** `.p8` anahtar içeriği (PEM). Boşsa bildirim gönderimi kapalıdır. */
  readonly APNS_KEY?: string;
  readonly APNS_KEY_ID?: string;
  readonly APNS_TEAM_ID?: string;
  readonly APNS_BUNDLE_ID?: string;
  readonly APNS_PRODUCTION?: string;
}

/** "true"/"1" → true; verilmemişse varsayılan. */
export const flag = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  return value === 'true' || value === '1';
};

/** Virgülle ayrılmış listeyi diziye çevirir. */
export const list = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0);

/** Telemetri toplansın mı. */
export const analyticsEnabled = (env: Env): boolean => flag(env.ANALYTICS_ENABLED, true);
