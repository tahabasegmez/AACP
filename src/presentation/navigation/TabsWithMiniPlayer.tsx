import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OfflineBar } from '../shared/components';
import { MiniPlayer } from '../features/player/components/MiniPlayer';
import { TabNavigator } from './TabNavigator';

/** Standart iOS/Android alt sekme yüksekliği (mini player'ı bunun üstüne koyar). */
const TAB_BAR_HEIGHT = 50;

/**
 * TabsWithMiniPlayer — sekmeler + tab bar'ın hemen üstünde sabit mini player.
 * Mini player bölüm yokken kendini gizler; `box-none` ile boş alanlarda
 * dokunuşlar sekmelere geçer.
 */
export const TabsWithMiniPlayer: React.FC = () => {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1 }}>
      <TabNavigator />
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: insets.bottom + TAB_BAR_HEIGHT,
        }}>
        <MiniPlayer />
        <OfflineBar />
      </View>
    </View>
  );
};
