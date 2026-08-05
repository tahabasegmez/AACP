import React from 'react';
import { useTheme } from '../../theme';
import { useOnlineStatus } from '../../ui';
import { StatusBanner } from './StatusBanner';

/**
 * OfflineBar — çevrimdışıyken görünen ince şerit.
 *
 * `GlobalDock` içinde, tab çubuğunun ve mini player'ın ÜSTÜNDE durur: hiçbirini
 * kapatmaz ve ekran içeriğini kaydırmaz. Çevrimiçiyken hiçbir şey render etmez.
 *
 * Görünüm ortak `StatusBanner`dan gelir; "başka cihazda çalıyor" şeridiyle aynı
 * yükseklik ve hizada durması böyle güvence altına alınır.
 */
export const OfflineBar: React.FC = () => {
  const theme = useTheme();
  const online = useOnlineStatus();

  if (online) {
    return null;
  }

  return (
    <StatusBanner
      icon="cloud-offline"
      label="Çevrimdışısın"
      background={theme.colors.warning}
      foreground="#1A1206"
    />
  );
};
