import { Result } from '@core/error';
import { PlaybackCommand, PlaybackDevice } from '../entities';

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

  /**
   * Oturumu devralır/tazeler.
   *
   * Devralınan cihazın O AN ÇALDIĞI bölüm de döner: devralan cihaz oradan
   * devam etmelidir. Kendi yerel kaydından devam etmek, yanlış bölümü yanlış
   * saniyeden çalmak demekti.
   */
  claim(): Promise<Result<DeviceSessionClaim>>;

  /** Oturumu bırakır (duraklatma/çıkış). Cihaz kaydı korunur. */
  release(): Promise<Result<void>>;

  /** Hesabın cihazları ve hangisinin çaldığı. */
  list(): Promise<Result<readonly PlaybackDevice[]>>;

  /**
   * Cihazın turu: kendini tazeler, bekleyen komutunu alır ve listeyi döner.
   *
   * `list` ile ayrı durur çünkü bu çağrı bir GELEN KUTUSU boşaltmasıdır —
   * komut okunduğunda silinir. Cihaz paneli gibi salt-okunur yüzeylerin bunu
   * çağırması, başka bir turun komutunu yutardı.
   */
  poll(nowPlaying?: PlaybackCommand): Promise<Result<DeviceSessionTick>>;

  /**
   * Oynatmayı başka bir cihaza aktarır.
   *
   * Hedef cihaz aktif olur ve komutu kendi turunda alır. Kaynak cihazın
   * durması ayrı bir komut değildir: oturumu kaybettiğini görüp duraklar.
   */
  transfer(
    toDeviceId: string,
    command: PlaybackCommand,
  ): Promise<Result<readonly PlaybackDevice[]>>;
}

/** Devralmanın sonucu: güncel liste + devralınan cihazın çaldığı bölüm. */
export interface DeviceSessionClaim {
  readonly devices: readonly PlaybackDevice[];
  /**
   * Devralınan cihaz ne çalıyordu (bölüm + saniye). Devralınacak bir oynatma
   * yoksa null — o zaman bu cihaz kendi bölümüne devam eder.
   */
  readonly nowPlaying: PlaybackCommand | null;
}

/** Bir turun sonucu: güncel liste + bekleyen komut + aktif cihazın çaldığı. */
export interface DeviceSessionTick extends DeviceSessionClaim {
  /** Bu cihaza bırakılmış komut; yoksa null. */
  readonly command: PlaybackCommand | null;
}
