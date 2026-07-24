import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { useTheme } from '../theme';
import { ShowDetailScreen } from '../features/shows/screens/ShowDetailScreen';
import { PlayerScreen } from '../features/player/screens/PlayerScreen';
import { SeeAllScreen } from '../features/home/screens/SeeAllScreen';
import { TabsWithMiniPlayer } from './TabsWithMiniPlayer';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator — kök stack: sekmeler + üstte açılan ekranlar (şov detayı,
 * tam liste, tam ekran player modal). CarPlay ayrı bir yüzeydir, burayı kullanmaz.
 */
export const RootNavigator: React.FC = () => {
  const theme = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.bg },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.bg },
      }}>
      <Stack.Screen name="Tabs" component={TabsWithMiniPlayer} options={{ headerShown: false }} />
      <Stack.Screen
        name="ShowDetail"
        component={ShowDetailScreen}
        options={{ headerTransparent: true, title: '' }}
      />
      <Stack.Screen name="SeeAll" component={SeeAllScreen} options={{ title: '' }} />
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
  );
};
