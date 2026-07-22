/**
 * Logger — uygulama genelinde loglama arayüzü.
 *
 * Arayüz olması sayesinde ileride Sentry / Crashlytics gibi bir servise
 * geçmek istediğimizde sadece implementasyonu değiştiririz, çağıran kod aynı kalır.
 */
export interface Logger {
  debug(message: string, ...meta: unknown[]): void;
  info(message: string, ...meta: unknown[]): void;
  warn(message: string, ...meta: unknown[]): void;
  error(message: string, ...meta: unknown[]): void;
}

/** Geliştirme için varsayılan konsol logger'ı. */
export class ConsoleLogger implements Logger {
  constructor(private readonly scope = 'AACP') {}

  private prefix(): string {
    return `[${this.scope}]`;
  }

  debug(message: string, ...meta: unknown[]): void {
    if (__DEV__) {
      console.debug(this.prefix(), message, ...meta);
    }
  }

  info(message: string, ...meta: unknown[]): void {
    console.info(this.prefix(), message, ...meta);
  }

  warn(message: string, ...meta: unknown[]): void {
    console.warn(this.prefix(), message, ...meta);
  }

  error(message: string, ...meta: unknown[]): void {
    console.error(this.prefix(), message, ...meta);
  }
}
