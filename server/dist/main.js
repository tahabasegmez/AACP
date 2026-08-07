"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_http_1 = __importDefault(require("node:http"));
const app_1 = require("./app");
const env_1 = require("./config/env");
const logger_1 = require("./core/logger");
/**
 * Giriş noktası — süreç yönetimi ve düzgün kapanış (graceful shutdown).
 *
 * Konteyner/systemd fark etmeksizin aynı şekilde davranır: SIGTERM/SIGINT
 * alındığında yeni bağlantı kabul etmez, açık istekleri bitirir, veritabanını
 * kapatır. Bu sayede yeniden dağıtımda veri bozulmaz.
 */
const main = async () => {
    const env = (0, env_1.loadEnv)();
    const logger = logger_1.consoleLogger;
    const { router, store, scheduler } = (0, app_1.createApp)(env, logger);
    await store.init();
    // Takip edilen şovlarda yeni bölüm taraması (FEED_WATCH_INTERVAL_MS=0 → kapalı).
    scheduler.start();
    const server = node_http_1.default.createServer((req, res) => {
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
    const shutdown = (signal) => {
        logger.info('Kapanıyor', { signal });
        scheduler.stop();
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
    logger_1.consoleLogger.error('Sunucu başlatılamadı', { error: String(error) });
    process.exit(1);
});
//# sourceMappingURL=main.js.map