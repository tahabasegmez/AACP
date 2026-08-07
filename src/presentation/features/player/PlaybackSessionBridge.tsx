import { usePlaybackSessionGuard } from './useDeviceSession';

/**
 * PlaybackSessionBridge — "aynı hesapta tek cihaz" kuralını uygulamanın ömrü
 * boyunca ayakta tutar.
 *
 * Kural bir ekrana değil oturuma aittir: player kapalıyken de geçerlidir.
 * Bu yüzden kancayı bir ekran değil, ağacın kökündeki bu görünmez bileşen
 * çağırır (görünmez kök bileşen deseni).
 */
export const PlaybackSessionBridge: React.FC = () => {
  usePlaybackSessionGuard();
  return null;
};
