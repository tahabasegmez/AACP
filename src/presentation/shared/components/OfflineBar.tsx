import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, Text, useOnlineStatus } from '../../ui';

/**
 * OfflineBar — çevrimdışıyken görünen kalıcı şerit.
 * Çevrimiçiyken hiçbir şey render etmez.
 */
export const OfflineBar: React.FC = () => {
  const theme = useTheme();
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(1),
        marginHorizontal: theme.spacing(1),
        marginTop: theme.spacing(0.75),
        paddingVertical: theme.spacing(0.75),
        borderRadius: theme.radius.sm,
        backgroundColor: theme.colors.warning,
      }}>
      <Icon name="cloud-offline" size={15} color="#1A1206" />
      <Text variant="caption" color="#1A1206">
        Çevrimdışısın — indirdiğin bölümler çalışmaya devam eder
      </Text>
    </View>
  );
};
