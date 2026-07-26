import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React, { useEffect } from 'react';
import { NavigationState, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme';
import { ShowDetailScreen } from '../features/shows/screens/ShowDetailScreen';
import { PlayerScreen } from '../features/player/screens/PlayerScreen';
import { QueueScreen } from '../features/player/screens/QueueScreen';
import { SeeAllScreen } from '../features/home/screens/SeeAllScreen';
import { SettingsScreen } from '../features/settings/screens/SettingsScreen';
import { DownloadsScreen } from '../features/downloads/screens/DownloadsScreen';
import { TabNavigator } from './TabNavigator';
import { useRouteStore } from '../stores';
import { resetScrim } from '../ui';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * PodcastNavigator — podcast özelliğinin TÜM ekran ağacı, gömülebilir biçimde.
 *
 * Ana uygulama bunu kendi stack'ine tek bir ekran olarak koyar:
 *
 * ```tsx
 * <Stack.Screen name="Podcasts" component={PodcastNavigator} options={{ headerShown: false }} />
 * ```
 *
 * Kendi NavigationContainer'ını KURMAZ (React Navigation v7 iç içe container
 * desteklemez) — ana uygulamanın container'ı içinde yaşar. Standalone modda ise
 * `AppRoot` bu ağacı kendi container'ıyla sarar.
 *
 * Aktif rota takibi burada yapılır ki mini player ve tab bar, podcast bölümüne
 * girildiğinde doğru davransın.
 */
export const PodcastNavigator: React.FC = () => {
  const theme = useTheme();

  return (
    <>
      <RouteTracker />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { color: theme.colors.text },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen
          name="ShowDetail"
          component={ShowDetailScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="SeeAll" component={SeeAllScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Queue" component={QueueScreen} options={{ headerShown: false }} />
        <Stack.Screen
          name="Downloads"
          component={DownloadsScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Player"
          component={PlayerScreen}
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
      </Stack.Navigator>
    </>
  );
};

/**
 * RouteTracker — podcast ağacındaki aktif rotayı store'a yazar.
 *
 * Standalone modda bunu NavigationContainer'ın `onStateChange`'i yapar; gömülü
 * modda container ana uygulamanındır ve ona dokunamayız. Bu bileşen aradaki
 * farkı kapatır: podcast bölümü hangi modda olursa olsun mini player/tab bar
 * doğru rotayı görür.
 */
const RouteTracker: React.FC = () => {
  const navigation = useNavigation();
  const setRouteName = useRouteStore(s => s.setRouteName);

  useEffect(() => {
    let lastName: string | undefined;

    const sync = (): void => {
      const name = leafRouteName(navigation.getState());
      if (name === lastName) {
        return; // aynı ekran: gereksiz scrim sıfırlaması yapma
      }
      lastName = name;
      setRouteName(name);
      resetScrim(); // yeni ekran en üstten başlar
    };

    sync();
    return navigation.addListener('state', sync);
  }, [navigation, setRouteName]);

  return null;
};

/** İç içe navigator state'inde gezinip EN DERİN (görünen) rotanın adını verir. */
const leafRouteName = (state: NavigationState | undefined): string | undefined => {
  let current = state;
  let name: string | undefined;

  // Tab/stack iç içeyse görünen ekran en alttaki yapraktır (ör. Tabs → Home).
  while (current) {
    const route = current.routes[current.index ?? 0];
    if (!route) {
      break;
    }
    name = route.name;
    current = route.state as NavigationState | undefined;
  }
  return name;
};
