import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBar } from '../../../shared/components';
import { useRouteStore } from '../../../stores';
import { openPlayer } from '../../../navigation/navigationRef';
import { MiniPlayer } from './MiniPlayer';

/** Standart alt sekme yüksekliği (mini player'ı tab ekranlarında bunun üstüne koyar). */
const TAB_BAR_HEIGHT = 50;

/** Mini player'ın gizleneceği ekranlar. */
const HIDDEN_ROUTES = ['Player', 'Settings'];
/** Alt sekmeli ekranlar (mini player tab bar'ın üstünde durur). */
const TAB_ROUTES = ['Home', 'Search', 'Library'];

/**
 * GlobalDock — mini player + çevrimdışı şeridi, NavigationContainer'ın ÜSTÜNDE
 * global overlay olarak. Böylece şov gezerken (ShowDetail) de görünür; Player ve
 * Ayarlar'da gizlenir. Konum, aktif ekrana göre (tab bar var/yok) ayarlanır.
 */
export const GlobalDock: React.FC = () => {
  const insets = useSafeAreaInsets();
  const routeName = useRouteStore(s => s.routeName);

  if (routeName && HIDDEN_ROUTES.includes(routeName)) {
    return null;
  }

  const onTabScreen = !routeName || TAB_ROUTES.includes(routeName);
  const bottom = onTabScreen ? insets.bottom + TAB_BAR_HEIGHT : insets.bottom + 8;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom }}>
      <MiniPlayer onOpen={openPlayer} />
      <OfflineBar />
    </View>
  );
};
