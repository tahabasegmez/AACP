import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';

/**
 * navigationRef — NavigationContainer dışından (global mini player gibi) navigasyon
 * ve geçerli rota bilgisi için. AppRoot bunu NavigationContainer'a bağlar.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export const openPlayer = () => {
  if (navigationRef.isReady()) {
    navigationRef.navigate('Player');
  }
};
