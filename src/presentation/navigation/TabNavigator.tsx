import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import React from 'react';
import { HomeScreen } from '../features/home/screens/HomeScreen';
import { SearchScreen } from '../features/search/screens/SearchScreen';
import { LibraryScreen } from '../features/library/screens/LibraryScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * TabNavigator — alt sekmeler: Ana Sayfa · Ara · Kütüphane.
 * Native tab bar GİZLİ (tabBar={() => null}); yerine GlobalDock içindeki
 * AnimatedTabBar kullanılıyor — böylece ekranlar arası geçişte animasyonla
 * (aşağı kayarak) görünüp kaybolabiliyor.
 */
export const TabNavigator: React.FC = () => (
  <Tab.Navigator screenOptions={{ headerShown: false }} tabBar={() => null}>
    <Tab.Screen name="Home" component={HomeScreen} />
    <Tab.Screen name="Search" component={SearchScreen} />
    <Tab.Screen name="Library" component={LibraryScreen} />
  </Tab.Navigator>
);
