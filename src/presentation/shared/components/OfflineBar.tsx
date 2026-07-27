import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../theme';
import { Icon, Text, useOnlineStatus } from '../../ui';

/**
 * OfflineBar — çevrimdışıyken ekranın EN ALTINDA görünen ince şerit.
 *
 * Kök seviyede, mutlak konumda durur: içeriği itmez, kaydırmaz ve layout'u
 * değiştirmez. Çevrimiçiyken hiçbir şey render etmez.
 */
export const OfflineBar: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(0.75),
        paddingVertical: 3,
        paddingBottom: insets.bottom > 0 ? insets.bottom : 3,
        backgroundColor: theme.colors.warning,
      }}>
      <Icon name="cloud-offline" size={12} color="#1A1206" />
      <Text variant="caption" color="#1A1206">
        Çevrimdışısın
      </Text>
    </View>
  );
};
