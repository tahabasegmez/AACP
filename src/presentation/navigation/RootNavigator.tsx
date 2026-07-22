import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';
import { ShowDetailScreen } from '../features/shows/screens/ShowDetailScreen';
import { ShowListScreen } from '../features/shows/screens/ShowListScreen';
import { PlayerScreen } from '../features/player/screens/PlayerScreen';
import { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * RootNavigator — mobil (iOS) uygulamanın ekran akışı.
 * CarPlay ayrı bir navigasyon yüzeyidir (src/carplay), burayı kullanmaz.
 */
export const RootNavigator: React.FC = () => (
  <Stack.Navigator initialRouteName="ShowList">
    <Stack.Screen
      name="ShowList"
      component={ShowListScreen}
      options={{ title: 'Podcastler' }}
    />
    <Stack.Screen name="ShowDetail" component={ShowDetailScreen} />
    <Stack.Screen
      name="Player"
      component={PlayerScreen}
      options={{ presentation: 'modal', title: 'Şimdi Çalıyor' }}
    />
  </Stack.Navigator>
);
