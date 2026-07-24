import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Icon, IconName, Text } from '../ui';
import { useRouteStore } from '../stores';
import { navigationRef } from './navigationRef';

const TABS: ReadonlyArray<{
  name: 'Home' | 'Search' | 'Library';
  label: string;
  icon: IconName;
  iconActive: IconName;
}> = [
  { name: 'Home', label: 'Ana Sayfa', icon: 'home-outline', iconActive: 'home' },
  { name: 'Search', label: 'Ara', icon: 'search', iconActive: 'search' },
  { name: 'Library', label: 'Kütüphane', icon: 'library-outline', iconActive: 'library' },
];

/**
 * AnimatedTabBar — özel (global) alt sekme çubuğu. Native tab bar yerine geçer;
 * GlobalDock içinde render edilir ki ekranlar arası animasyonla (aşağı kayarak)
 * görünüp kaybolabilsin. Aktif sekme routeStore.lastTab'dan gelir.
 */
export const AnimatedTabBar: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const active = useRouteStore(s => s.lastTab);

  const go = (name: 'Home' | 'Search' | 'Library') => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('Tabs', { screen: name });
    }
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: theme.spacing(1),
        paddingBottom: insets.bottom + theme.spacing(1),
        backgroundColor: theme.colors.bg,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
      }}>
      {TABS.map(tab => {
        const isActive = active === tab.name;
        const color = isActive ? theme.colors.accent : theme.colors.textMuted;
        return (
          <Pressable
            key={tab.name}
            onPress={() => go(tab.name)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
            style={{ alignItems: 'center', gap: 3, flex: 1 }}>
            <Icon name={isActive ? tab.iconActive : tab.icon} size={22} color={color} />
            <Text variant="caption" color={color} style={{ fontSize: 10 }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};
