import http from 'node:http';
import { createApp } from './app';
import { loadEnv } from './config/env';
import { consoleLogger } from './core/logger';

/**
 * Giriş noktası — süreç yönetimi ve düzgün kapanış (graceful shutdown).
 *
 * Konteyner/systemd fark etmeksizin aynı şekilde davranır: SIGTERM/SIGINT
 * alındığında yeni bağlantı kabul etmez, açık istekleri bitirir, veritabanını
 * kapatır. Bu sayede yeniden dağıtımda veri bozulmaz.
 */
const main = async (): Promise<void> => {
  const env = loadEnv();
  const logger = consoleLogger;
  const { router, store } = createApp(env, logger);

  await store.init();

  const server = http.createServer((req, res) => {
    void router.handler(req, res);
  });

  server.listen(env.port, env.host, () => {
    logger.info('AACP sunucusu başladı', {
      host: env.host,
      port: env.port,
      env: env.nodeEnv,
      storage: env.storageDriver,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info('Kapanıyor', { signal });
    server.close(() => {
      void store.close().finally(() => process.exit(0));
    });
    // Askıda kalan bağlantılar için üst sınır (kapanışı sonsuza dek bekletme).
    const failsafe = setTimeout(() => process.exit(1), 10_000);
    failsafe.unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

main().catch(error => {
  consoleLogger.error('Sunucu başlatılamadı', { error: String(error) });
  process.exit(1);
});
