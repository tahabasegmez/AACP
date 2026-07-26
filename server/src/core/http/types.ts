import type { IncomingMessage, ServerResponse } from 'node:http';

/** Çözülmüş istek — handler'lar ham Node nesneleriyle uğraşmaz. */
export interface RequestContext {
  readonly method: string;
  readonly path: string;
  readonly query: URLSearchParams;
  /** Yol parametreleri, ör. `/v1/shows/:id` → `{ id: '...' }`. */
  readonly params: Readonly<Record<string, string>>;
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  /** JSON gövde (varsa) — router tarafından ayrıştırılır. */
  readonly body: unknown;
  /** Doğrulanmış kullanıcı kimliği; anonim isteklerde undefined. */
  readonly userId?: string;
  readonly ip: string;
  readonly raw: { req: IncomingMessage; res: ServerResponse };
}

/** Handler dönüşü — gövde ve durum kodu. */
export interface HttpResult {
  readonly status: number;
  readonly body?: unknown;
  readonly headers?: Record<string, string>;
}

export type Handler = (ctx: RequestContext) => Promise<HttpResult> | HttpResult;

/** Yardımcı yanıt kurucuları — durum kodları tek yerden. */
export const ok = (body?: unknown): HttpResult => ({ status: 200, body });
export const created = (body?: unknown): HttpResult => ({ status: 201, body });
export const noContent = (): HttpResult => ({ status: 204 });
