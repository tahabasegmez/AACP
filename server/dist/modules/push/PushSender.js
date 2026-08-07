"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggingPushSender = void 0;
/**
 * LoggingPushSender — APNs/FCM yapılandırılmadığında kullanılan adaptör.
 *
 * Bildirimleri göndermez, yalnızca loglar. Böylece tarayıcı ve zamanlama
 * mantığı gerçek sertifikalar olmadan uçtan uca çalıştırılıp doğrulanabilir;
 * üretimde gerçek adaptörle değiştirilir.
 */
class LoggingPushSender {
    logger;
    enabled = true;
    constructor(logger) {
        this.logger = logger;
    }
    async send(messages) {
        for (const message of messages) {
            this.logger.info('push (kuru çalıştırma)', {
                platform: message.platform,
                title: message.title,
                body: message.body,
                // Jetonun tamamı loglanmaz — kısmi kimlik yeterli.
                token: `${message.token.slice(0, 8)}…`,
            });
        }
        return { sent: messages.length, failed: 0 };
    }
}
exports.LoggingPushSender = LoggingPushSender;
//# sourceMappingURL=PushSender.js.map