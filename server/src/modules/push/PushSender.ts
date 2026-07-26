import type { Logger } from '../../core/logger';

/** Gönderilecek bildirim. */
export interface PushMessage {
  readonly token: string;
  readonly platform: string;
  readonly title: string;
  readonly body: string;
  /** Uygulamanın derin bağlantı için kullanacağı veri. */
  readonly data?: Readonly<Record<string, string>>;
}

/**
 * PushSender — bildirim gönderme PORTU.
 *
 * Gerçek gönderim (APNs/FCM) bir adaptörle sağlanır. Port sayesinde tarayıcı
 * (FeedWatcher) hangi sağlayıcının kullanıldığını bilmez; APNs anahtarı
 * hazır olduğunda yalnızca yeni bir adaptör yazılıp `app.ts`'te bağlanır.
 */
export interface PushSender {
  /** Sağlayıcı yapılandırılmış mı (değilse tarayıcı gönderim adımını atlar). */
  readonly enabled: boolean;
  send(messages: readonly PushMessage[]): Promise<{ sent: number; failed: number }>;
}

/**
 * LoggingPushSender — APNs/FCM yapılandırılmadığında kullanılan adaptör.
 *
 * Bildirimleri göndermez, yalnızca loglar. Böylece tarayıcı ve zamanlama
 * mantığı gerçek sertifikalar olmadan uçtan uca çalıştırılıp doğrulanabilir;
 * üretimde gerçek adaptörle değiştirilir.
 */
export class LoggingPushSender implements PushSender {
  readonly enabled = true;

  constructor(private readonly logger: Logger) {}

  async send(messages: readonly PushMessage[]): Promise<{ sent: number; failed: number }> {
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
