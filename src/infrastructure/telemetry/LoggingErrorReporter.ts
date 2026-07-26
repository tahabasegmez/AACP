import { Logger } from '@core/logger';
import { Analytics, ErrorReporter } from '@core/ports';

/**
 * LoggingErrorReporter — hataları loglar ve (varsa) telemetriye `error` olayı
 * olarak iletir.
 *
 * Sentry gibi bir servise geçilmek istendiğinde yeni bir `ErrorReporter`
 * adaptörü yazmak ve composition root'ta değiştirmek yeterlidir; çağıran kod
 * hiç değişmez. Hata mesajı kısaltılır — telemetri yükünü şişirmesin.
 */
export class LoggingErrorReporter implements ErrorReporter {
  constructor(
    private readonly logger: Logger,
    private readonly analytics: Analytics,
  ) {}

  report(error: unknown, context: Readonly<Record<string, unknown>> = {}): void {
    this.logger.error('Beklenmeyen hata', error, context);
    this.analytics.track('error', {
      message: describe(error).slice(0, 200),
      ...flatten(context),
    });
  }
}

const describe = (error: unknown): string => {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
};

/** Bağlamı telemetrinin kabul ettiği ilkel değerlere indirger. */
const flatten = (
  context: Readonly<Record<string, unknown>>,
): Record<string, string | number | boolean> => {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(context)) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
    }
  }
  return out;
};
