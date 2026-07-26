/**
 * Logger — yapılandırılmış (JSON satırı) günlükleme.
 *
 * JSON satırları herhangi bir log toplayıcı (journald, Loki, CloudWatch)
 * tarafından ayrıştırılabilir; sunucuya özgü bir bağımlılık yoktur.
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

const write = (level: string, message: string, meta?: Record<string, unknown>): void => {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    message,
    ...(meta ?? {}),
  });
  if (level === 'error') {
    process.stderr.write(`${line}\n`);
  } else {
    process.stdout.write(`${line}\n`);
  }
};

export const consoleLogger: Logger = {
  info: (m, meta) => write('info', m, meta),
  warn: (m, meta) => write('warn', m, meta),
  error: (m, meta) => write('error', m, meta),
};

/** Testlerde gürültü olmasın diye sessiz logger. */
export const silentLogger: Logger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};
