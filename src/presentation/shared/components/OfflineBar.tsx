import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, Text, useOnlineStatus } from '../../ui';

/**
 * OfflineBar — çevrimdışıyken görünen ince şerit.
 *
 * `GlobalDock` içinde, tab çubuğunun ve mini player'ın ÜSTÜNDE durur: hiçbirini
 * kapatmaz ve ekran içeriğini kaydırmaz. Çevrimiçiyken hiçbir şey render etmez.
 */
export const OfflineBar: React.FC = () => {
  const theme = useTheme();
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <View
      pointerEvents="none"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(0.75),
        marginHorizontal: theme.spacing(1),
        marginBottom: theme.spacing(0.75),
        paddingVertical: 4,
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.warning,
      }}>
      <Icon name="cloud-offline" size={12} color="#1A1206" />
      <Text variant="caption" color="#1A1206">
        Çevrimdışısın
      </Text>
    </View>
  );
};
