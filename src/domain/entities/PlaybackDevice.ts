/**
 * PlaybackDevice — hesabın oynatma yapabildiği bir cihaz.
 *
 * Bir hesapta AYNI ANDA tek cihaz çalabilir. Kural sunucuda (veritabanında)
 * zorlanır; istemci yalnızca sonucu gösterir ve devraldığında/kaybettiğinde
 * buna göre davranır.
 */
export interface PlaybackDevice {
  /** Kurulum başına kararlı kimlik. */
  readonly id: string;
  readonly name: string;
  readonly platform: string;
  /** Oynatma oturumunu şu an bu cihaz mı tutuyor. */
  readonly active: boolean;
  /** Son görülme (ISO). */
  readonly lastSeenAt: string;
}

/** Listede o an çalan cihaz (varsa). */
export const activeDevice = (
  devices: readonly PlaybackDevice[],
): PlaybackDevice | undefined => devices.find(device => device.active);

/**
 * Oynatma bu cihazdan BAŞKA bir cihaza mı geçmiş?
 *
 * Hiç aktif cihaz yoksa `false`: oturum boştur, kimse çalmıyor demektir —
 * bu bir kayıp değildir.
 */
export const playbackTakenOver = (
  devices: readonly PlaybackDevice[],
  thisDeviceId: string,
): boolean => {
  const active = activeDevice(devices);
  return !!active && active.id !== thisDeviceId;
};
