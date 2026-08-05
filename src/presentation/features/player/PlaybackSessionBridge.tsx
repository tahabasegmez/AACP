import { usePlaybackSessionGuard } from './useDeviceSession';

/**
 * PlaybackSessionBridge — "aynı hesapta tek cihaz" kuralını uygulamanın ömrü
 * boyunca ayakta tutar.
 *
 * Kural bir ekrana değil oturuma aittir: player kapalıyken de geçerlidir.
 * Bu yüzden kancayı bir ekran değil, ağacın kökündeki bu görünmez bileşen
 * çağırır (RemoteQueueBridge ile aynı desen).
 */
export const PlaybackSessionBridge: React.FC = () => {
  usePlaybackSessionGuard();
  return null;
};
