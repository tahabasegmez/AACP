import React from 'react';
import { useTheme } from '../../../theme';
import { StatusBanner } from '../../../shared/components';
import { useDeviceSessionStore } from '../../../stores';
import { useTakeOverPlayback } from '../useDeviceSession';

/**
 * PlaybackElsewhereBar — oynatma başka bir cihaza geçtiğinde beliren şerit.
 *
 * Çevrimdışı şeridiyle AYNI bileşeni kullanır; yalnızca rengi ve eylemi
 * farklıdır. Sessizce duraklamak kullanıcıya sebebini söylemezdi; tek
 * dokunuşla geri almak da mümkün olmalı.
 */
export const PlaybackElsewhereBar: React.FC = () => {
  const theme = useTheme();
  const takenOverBy = useDeviceSessionStore(s => s.takenOverBy);
  const takeOver = useTakeOverPlayback();

  if (!takenOverBy) {
    return null;
  }

  return (
    <StatusBanner
      icon="cast"
      label={`${takenOverBy} üzerinde çalıyor`}
      actionLabel="Buraya al"
      background={theme.colors.accent}
      foreground={theme.colors.onAccent}
      onPress={() => void takeOver()}
    />
  );
};
