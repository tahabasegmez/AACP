import React, { useState } from 'react';
import { Episode } from '@domain/entities';
import { useTheme } from '../../theme';
import { SwipeableRow } from '../../ui';
import { usePlayerQueueStore } from '../../stores';
import { EpisodeRow } from '../shows/components/EpisodeRow';
import { AddToPlaylistSheet } from '../playlists/components/AddToPlaylistSheet';

type EpisodeRowProps = React.ComponentProps<typeof EpisodeRow>;

/**
 * SwipeableEpisodeRow — bölüm satırı + kaydırma eylemleri.
 *
 * Uygulamadaki TÜM dikey bölüm listeleri bunu kullanır; böylece davranış her
 * yerde aynıdır ve `EpisodeRow` sunum bileşeni olarak sade kalır:
 *   - **sağa kaydır** → bölümü oynatma kuyruğuna ekle,
 *   - **sola kaydır** → listeye ekle panelini aç.
 *
 * Panel bu bileşenin içinde tutulur ki her satır kendi akışını yönetsin ve
 * çağıran ekranlar ek durum taşımak zorunda kalmasın.
 */
export const SwipeableEpisodeRow: React.FC<EpisodeRowProps> = props => {
  const theme = useTheme();
  const enqueue = usePlayerQueueStore(s => s.enqueue);
  const [playlistOpen, setPlaylistOpen] = useState(false);

  return (
    <>
      <SwipeableRow
        right={{
          icon: 'queue',
          label: 'Sıraya ekle',
          color: theme.colors.accent,
          onTrigger: () => enqueue(props.episode),
        }}
        left={{
          icon: 'playlist',
          label: 'Listeye ekle',
          color: theme.colors.elevated,
          onTrigger: () => setPlaylistOpen(true),
        }}>
        <EpisodeRow {...props} />
      </SwipeableRow>

      <AddToPlaylistSheet
        visible={playlistOpen}
        episode={props.episode as Episode}
        onClose={() => setPlaylistOpen(false)}
      />
    </>
  );
};
