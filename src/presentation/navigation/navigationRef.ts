import {
  NavigationContainerRefWithCurrent,
  createNavigationContainerRef,
} from '@react-navigation/native';
import type { ShareTarget } from '@domain/entities';
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

/**
 * Paylaşılan bir bağlantının hedefini açar.
 *
 * Her iki tür de şov ekranına gider; bölüm bağlantısında ekran, bölüm listeye
 * indiğinde ayrıntı panelini kendisi açar. Doğrudan "bölüm ekranı" YOKTUR:
 * bir bölüm her zaman şovunun içinde yaşar ve kullanıcı bağlantıdan geldiğinde
 * de bağlamı görmelidir.
 *
 * Navigasyon henüz hazır değilse (soğuk açılışta bağlantı, container
 * kurulmadan gelebilir) kısa bir süre beklenip yeniden denenir.
 */
export const openShareTarget = (target: ShareTarget): void => {
  const params =
    target.kind === 'episode'
      ? { showId: target.showId, episodeId: target.episodeId }
      : { showId: target.showId };

  const go = (attempt: number): void => {
    if (activeRef.isReady()) {
      activeRef.navigate('ShowDetail', params);
      return;
    }
    if (attempt < NAV_READY_ATTEMPTS) {
      setTimeout(() => go(attempt + 1), NAV_READY_RETRY_MS);
    }
  };

  go(0);
};

/** Navigasyonun hazır olmasını bekleme adımı ve üst sınırı (~3 sn). */
const NAV_READY_RETRY_MS = 100;
const NAV_READY_ATTEMPTS = 30;
