import React, { useState } from 'react';
import { Episode } from '@domain/entities';
import { SwipeableRow } from '../../ui';
import { EpisodeRow } from '../shows/components/EpisodeRow';
import { AddToPlaylistSheet } from '../playlists/components/AddToPlaylistSheet';
import { EpisodeListContext, useEpisodeSwipeActions } from './episodeSwipeActions';

type EpisodeRowProps = React.ComponentProps<typeof EpisodeRow>;

/**
 * SwipeableEpisodeRow — bölüm satırı + kaydırma eylemleri.
 *
 * Uygulamadaki TÜM dikey bölüm listeleri bunu kullanır; böylece jest her yerde
 * aynı hisle çalışır ve `EpisodeRow` sunum bileşeni olarak sade kalır.
 *
 * Eylemin NE YAPACAĞI bağlama göre değişir ve tek yerde kararlaştırılır
 * (bkz. `useEpisodeSwipeActions`): bir listenin içinde sola kaydırmak bölümü
 * o listeden çıkarır, başka her yerde listeye ekleme panelini açar.
 *
 * Panel bu bileşenin içinde tutulur ki her satır kendi akışını yönetsin ve
 * çağıran ekranlar ek durum taşımak zorunda kalmasın.
 */
export const SwipeableEpisodeRow: React.FC<
  EpisodeRowProps & { context?: EpisodeListContext }
> = ({ context, ...props }) => {
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const { left, right } = useEpisodeSwipeActions({
    episode: props.episode as Episode,
    context,
    onAddToPlaylist: () => setPlaylistOpen(true),
  });

  return (
    <>
      <SwipeableRow right={right} left={left}>
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
