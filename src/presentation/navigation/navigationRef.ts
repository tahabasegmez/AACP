import {
  NavigationContainerRefWithCurrent,
  createNavigationContainerRef,
} from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * navigationRef — NavigationContainer dışından (global mini player gibi)
 * navigasyon ve geçerli rota bilgisi için.
 *
 * İKİ MOD:
 *  - **Standalone**: AppRoot bu ref'i kendi NavigationContainer'ına bağlar.
 *  - **Gömülü**: podcast, ana uygulamanın NavigationContainer'ı içinde yaşar.
 *    Ana uygulama kendi ref'ini `setNavigationRef()` ile buraya verir; böylece
 *    mini player/Player açma gibi container-dışı navigasyonlar aynı şekilde
 *    çalışır ve çağıran kod hangi modda olduğunu BİLMEZ.
 *
 * (React Navigation v7 iç içe NavigationContainer'ı desteklemediği için gömülü
 * modda kendi container'ımızı kurmayız — ana uygulamanınkine katılırız.)
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/** Etkin navigasyon hedefi — varsayılan olarak kendi ref'imiz. */
type NavRef = NavigationContainerRefWithCurrent<RootStackParamList>;
let activeRef: NavRef = navigationRef;

/**
 * Gömülü modda ana uygulamanın navigation ref'ini bağlar.
 * `undefined` verilirse standalone davranışa (kendi ref'imize) döner.
 */
export const setNavigationRef = (ref?: NavRef): void => {
  activeRef = ref ?? navigationRef;
};

/** Etkin ref — rota takibi ve navigasyon bunun üzerinden yapılır. */
export const getNavigationRef = (): NavRef => activeRef;

/** Tam ekran Player'ı açar (hangi modda olursak olalım). */
export const openPlayer = (): void => {
  if (activeRef.isReady()) {
    activeRef.navigate('Player');
  }
};
