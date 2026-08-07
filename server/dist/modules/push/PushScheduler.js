"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PushScheduler = void 0;
/**
 * PushScheduler — FeedWatcher'ı düzenli aralıklarla çalıştırır.
 *
 * Harici bir zamanlayıcıya (cron, systemd timer) bağımlılık yaratmamak için
 * süreç içinde çalışır; böylece "docker compose up" tek başına yeterlidir.
 * Ayrı bir worker sürecine taşınmak istenirse `runOnce()` doğrudan çağrılabilir
 * (`FeedWatcher` zamanlamadan bağımsızdır).
 *
 * Not: Birden çok sunucu örneği çalıştırılırsa tarama tekrarlanır. Tek örnekli
 * dağıtım varsayılır; ölçeklenirse bu iş tek bir örneğe sabitlenmelidir.
 */
class PushScheduler {
    watcher;
    logger;
    intervalMs;
    timer;
    running = false;
    constructor(watcher, logger, intervalMs) {
        this.watcher = watcher;
        this.logger = logger;
        this.intervalMs = intervalMs;
    }
    /** Zamanlayıcıyı başlatır. `intervalMs <= 0` ise devre dışı kalır. */
    start() {
        if (this.intervalMs <= 0 || this.timer) {
            return;
        }
        this.logger.info('Feed tarayıcı başladı', { intervalMs: this.intervalMs });
        // İlk tarama biraz gecikmeli — açılış yükünü artırmasın.
        const kickoff = setTimeout(() => void this.tick(), 30_000);
        kickoff.unref();
        this.timer = setInterval(() => void this.tick(), this.intervalMs);
        this.timer.unref();
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
    }
    /** Bir tur tarama; önceki tur bitmediyse atlanır. */
    async tick() {
        if (this.running) {
            return;
        }
        this.running = true;
        try {
            const result = await this.watcher.runOnce();
            this.logger.info('Feed taraması tamamlandı', result);
        }
        catch (error) {
            this.logger.error('Feed taraması başarısız', { error: String(error) });
        }
        finally {
            this.running = false;
        }
    }
}
exports.PushScheduler = PushScheduler;
//# sourceMappingURL=PushScheduler.js.map