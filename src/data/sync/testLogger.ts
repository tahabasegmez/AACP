import { Logger } from '@core/logger';

/** Testlerde konsolu kirletmeyen sessiz logger. */
export const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
};
