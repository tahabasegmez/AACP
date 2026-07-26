/**
 * Transistor API (v1) yanıt şekilleri — JSON:API benzeri `{ data: [...] }` formatı.
 * Yalnızca kullandığımız alanlar tanımlıdır; bilinmeyen alanlar yok sayılır.
 *
 * Kaynak: https://developers.transistor.fm/
 */

export interface TransistorShowAttributes {
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
  readonly image_url?: string;
  readonly website?: string;
  readonly language?: string;
  readonly slug?: string;
  /** Şovun herkese açık RSS adresi. */
  readonly feed_url?: string;
}

export interface TransistorEpisodeAttributes {
  readonly title?: string;
  readonly summary?: string;
  readonly description?: string;
  /** Çalınabilir ses dosyası. */
  readonly media_url?: string;
  readonly audio_url?: string;
  readonly duration?: number;
  readonly published_at?: string;
  readonly image_url?: string;
  readonly number?: number;
  readonly season?: number;
  readonly formatted_summary?: string;
  readonly share_url?: string;
  readonly status?: string;
}

export interface TransistorResource<TAttributes> {
  readonly id?: string;
  readonly type?: string;
  readonly attributes?: TAttributes;
}

export interface TransistorCollection<TAttributes> {
  readonly data?: ReadonlyArray<TransistorResource<TAttributes>>;
  readonly meta?: {
    readonly currentPage?: number;
    readonly totalPages?: number;
    readonly totalCount?: number;
  };
}

export interface TransistorSingle<TAttributes> {
  readonly data?: TransistorResource<TAttributes>;
}

export type TransistorShowDto = TransistorResource<TransistorShowAttributes>;
export type TransistorEpisodeDto = TransistorResource<TransistorEpisodeAttributes>;
