import { create } from 'zustand';

/**
 * deviceSessionStore — oynatma oturumunun BU cihazdaki görünümü.
 *
 * Yalnızca "oturumu kaybettik mi" bilgisini tutar; cihaz listesi sorgu
 * katmanından (TanStack Query) gelir. Kaybı ayrı bir durumda tutmanın sebebi,
 * hem oynatıcı ekranının hem global şeridin aynı bilgiyi görmesi gerekmesi.
 */
interface DeviceSessionState {
  /** Oynatmayı devralan cihazın adı; kayıp yoksa null. */
  takenOverBy: string | null;
  setTakenOverBy: (name: string | null) => void;
}

export const useDeviceSessionStore = create<DeviceSessionState>(set => ({
  takenOverBy: null,
  setTakenOverBy: takenOverBy => set({ takenOverBy }),
}));
