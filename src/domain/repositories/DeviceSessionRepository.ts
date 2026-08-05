import { Result } from '@core/error';
import { PlaybackDevice } from '../entities';

/**
 * DeviceSessionRepository — "hangi cihaz çalıyor" oturumunun PORTU.
 *
 * Bir hesapta aynı anda tek cihaz çalabilir. `claim` oturumu DEVRALIR ve aynı
 * zamanda tazeleme (heartbeat) olarak kullanılır — ikisi aynı işlemdir, bu
 * yüzden ayrı bir metot tanımlanmaz.
 *
 * Sunucu yapılandırılmamışsa `available` false olur ve uygulama tek cihaz
 * kuralı olmadan çalışır: yerel kurulumda hesap kavramı yoktur, kuralı
 * uygulamak anlamsız olurdu.
 */
export interface DeviceSessionRepository {
  readonly available: boolean;

  /** Bu cihazın kimliği (kurulum başına kararlı). */
  deviceId(): string;

  /** Oturumu devralır/tazeler; hesabın güncel cihaz listesini döner. */
  claim(): Promise<Result<readonly PlaybackDevice[]>>;

  /** Oturumu bırakır (duraklatma/çıkış). Cihaz kaydı korunur. */
  release(): Promise<Result<void>>;

  /** Hesabın cihazları ve hangisinin çaldığı. */
  list(): Promise<Result<readonly PlaybackDevice[]>>;
}
