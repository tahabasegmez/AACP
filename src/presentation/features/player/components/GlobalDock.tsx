import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBar } from '../../../shared/components';
import { AnimatedTabBar } from '../../../navigation/AnimatedTabBar';
import { useRouteStore } from '../../../stores';
import { openPlayer } from '../../../navigation/navigationRef';
import { MiniPlayer } from './MiniPlayer';

/** Tab çubuğu içerik yüksekliği (safe-area hariç). */
const TAB_CONTENT_H = 52;
/** Mini player'ın çıplak yüksekliği (yaklaşık). */
const MINI_H = 66;

/** Tüm dock'un gizleneceği ekranlar. */
const HIDDEN_ROUTES = ['Player', 'Settings'];
/** Tab çubuğunun görüneceği (sekmeli) ekranlar. */
const TAB_ROUTES = ['Home', 'Search', 'Library'];

/**
 * GlobalDock — mini player + çevrimdışı şeridi + animasyonlu tab bar; hepsi
 * NavigationContainer'ın ÜSTÜNDE global overlay. Şov gezerken (ShowDetail) tab
 * bar animasyonla aşağı kayıp kaybolur, mini player aşağı iner. Player/Ayarlar'da
 * tüm dock gizli.
 */
export const GlobalDock: React.FC = () => {
  const insets = useSafeAreaInsets();
  const routeName = useRouteStore(s => s.routeName);
  const anim = useRef(new Animated.Value(0)).current; // 0: tab görünür, 1: gizli

  const tabsHidden = !!routeName && !TAB_ROUTES.includes(routeName);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: tabsHidden ? 1 : 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [tabsHidden, anim]);

  if (routeName && HIDDEN_ROUTES.includes(routeName)) {
    return null;
  }

  const tabTotal = insets.bottom + TAB_CONTENT_H;
  const tabTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [0, tabTotal + 8] });
  const tabOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  // Tab gizlenince mini player aşağı insin (tab içeriği kadar).
  const miniTranslate = anim.interpolate({ inputRange: [0, 1], outputRange: [0, TAB_CONTENT_H] });

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}>
      {/* Mini player + çevrimdışı şeridi (tab bar'ın üstünde) */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: tabTotal + 6,
          transform: [{ translateY: miniTranslate }],
        }}>
        <MiniPlayer onOpen={openPlayer} />
        <OfflineBar />
      </Animated.View>

      {/* Animasyonlu tab bar (en altta) */}
      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          opacity: tabOpacity,
          transform: [{ translateY: tabTranslate }],
        }}>
        <AnimatedTabBar />
      </Animated.View>

      {/* Yükseklik ölçmek için (dokunuşları geçirir) */}
      <View pointerEvents="none" style={{ height: tabTotal + MINI_H }} />
    </View>
  );
};
