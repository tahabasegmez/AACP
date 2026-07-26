/**
 * Telemetri portları — kullanım olayları ve hata raporlama.
 *
 * Uygulama kodu YALNIZCA bu arayüzleri görür; arkasında backend'imiz, Sentry,
 * Firebase ya da hiçbir şey (no-op) olabilir. Sağlayıcı değiştirmek yalnızca
 * composition root'ta bir satırdır.
 */

/** Toplanan olay adları — açık liste (sunucudaki liste ile eşleşir). */
export type AnalyticsEventName =
  | 'app_open'
  | 'screen_view'
  | 'episode_play'
  | 'episode_complete'
  | 'episode_download'
  | 'show_follow'
  | 'search'
  | 'error';

/** Olay yükü — kişisel veri İÇERMEZ (id'ler ve sayısal ölçümler). */
export type AnalyticsPayload = Readonly<Record<string, string | number | boolean | undefined>>;

export interface Analytics {
  /** Bir olayı kaydeder. Gönderim toplu/gecikmeli olabilir (uygulama beklemez). */
  track(name: AnalyticsEventName, payload?: AnalyticsPayload): void;
  /** Bekleyen olayları hemen göndermeye çalışır (ör. uygulama arka plana geçerken). */
  flush(): Promise<void>;
}

/**
 * ErrorReporter — beklenmeyen hataların raporlanması.
 * Sentry gibi bir servise geçilmek istenirse yalnızca yeni bir adaptör yazılır.
 */
export interface ErrorReporter {
  /** Yakalanmış bir hatayı bağlamıyla raporlar. */
  report(error: unknown, context?: Readonly<Record<string, unknown>>): void;
}
