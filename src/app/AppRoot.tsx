import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
} from '@react-navigation/native';
import React from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  PodcastNavigator,
  PodcastOverlays,
  navigationRef,
  useTheme,
} from '@presentation';
import { PodcastProviders } from './PodcastProviders';

/**
 * AppRoot — STANDALONE uygulamanın kökü.
 *
 * Podcast'i kendi başına çalışan bir uygulama olarak ayağa kaldırır: platform
 * kabuğu (gesture/safe-area) + `PodcastProviders` + kendi NavigationContainer'ı.
 *
 * Aynı özellik başka bir RN uygulamasının içine gömülecekse bu dosya KULLANILMAZ;
 * bunun yerine `PodcastProviders` + `PodcastNavigator` doğrudan kullanılır
 * (bkz. docs/EMBEDDING.md). İki mod da aynı parçaları paylaşır — tek fark
 * NavigationContainer'ın kime ait olduğudur.
 */
export const AppRoot: React.FC = () => (
  <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <PodcastProviders>
        <Navigation />
      </PodcastProviders>
    </SafeAreaProvider>
  </GestureHandlerRootView>
);

/**
 * Navigation — NavigationContainer'ı uygulama temasıyla besler (beyaz geçiş
 * parlamalarını önler; zemin ve accent tema token'larından gelir).
 */
const Navigation: React.FC = () => {
  const theme = useTheme();
  const navTheme: NavTheme = {
    ...(theme.dark ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme.dark ? DarkTheme : DefaultTheme).colors,
      primary: theme.colors.accent,
      background: theme.colors.bg,
      card: theme.colors.bg,
      text: theme.colors.text,
      border: theme.colors.border,
    },
  };
  // Not: aktif rota takibi PodcastNavigator içindeki RouteTracker'da yapılır —
  // böylece standalone ve gömülü mod aynı kodu paylaşır.
  return (
    <View style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef} theme={navTheme}>
        <PodcastNavigator />
      </NavigationContainer>
      {/* Mini player, tab bar ve üst scrim — navigasyonun üstünde overlay. */}
      <PodcastOverlays />
    </View>
  );
};
