import { Alert } from 'react-native';
import { Episode } from '@domain/entities';
import { useTheme } from '../../theme';
import { SwipeAction } from '../../ui';

import { useRemoveEpisodeFromPlaylist } from '../../query';
import { usePlaybackController } from '../player/usePlaybackController';

/**
 * Bölüm satırının GÖSTERİLDİĞİ YER.
 *
 * Kaydırma jesti her yerde aynı mekanikle çalışır ama işi bağlama göre değişir:
 * bir listenin içindeyken sola kaydırmak "listeden çıkar", başka her yerde
 * "listeye ekle" demektir. Bağlam açık bir parametredir — gizli bir context
 * yerine çağıran ekranın verdiği bir değerdir, böylece satırın ne yapacağı
 * çağrı yerine bakarak anlaşılır.
 */
export interface EpisodeListContext {
  /** Satır bir listenin içinde gösteriliyorsa o listenin kimliği. */
  readonly playlistId?: string;
}

/** Kaydırma eylemlerini kuran girdi. */
interface Input {
  readonly episode: Episode;
  readonly context?: EpisodeListContext;
  /** "Listeye ekle" panelini açar (yer bağlamı yoksa kullanılır). */
  readonly onAddToPlaylist: () => void;
}

/**
 * Bölüm satırının kaydırma eylemleri — TEK karar yeri.
 *
 * Sağa kaydırma her yerde aynıdır (sıraya ekle); sola kaydırma bağlama göre
 * değişir. Eylemleri burada toplamak, davranışın ekranlara dağılmasını ve
 * zamanla ayrışmasını önler.
 */
export const useEpisodeSwipeActions = ({
  episode,
  context,
  onAddToPlaylist,
}: Input): { right: SwipeAction; left: SwipeAction } => {
  const theme = useTheme();
  const { enqueue } = usePlaybackController();
  const removeEpisode = useRemoveEpisodeFromPlaylist();

  const playlistId = context?.playlistId;

  const right: SwipeAction = {
    icon: 'queue',
    label: 'Sıraya ekle',
    color: theme.colors.accent,
    onTrigger: () => void enqueue(episode),
  };

  if (!playlistId) {
    return {
      right,
      left: {
        icon: 'playlist',
        label: 'Listeye ekle',
        color: theme.colors.elevated,
        onTrigger: onAddToPlaylist,
      },
    };
  }

  return {
    right,
    left: {
      icon: 'playlist-remove',
      label: 'Listeden çıkar',
      color: theme.colors.danger,
      // Çıkarma geri alınamaz ve yanlışlıkla kaydırmak kolaydır; bu yüzden
      // onay sorulur. Uzun basma da aynı akışı kullanır.
      onTrigger: () =>
        Alert.alert('Listeden çıkar', `"${episode.title}" listeden çıkarılsın mı?`, [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Çıkar',
            style: 'destructive',
            onPress: () => removeEpisode.mutate({ playlistId, episodeId: episode.id }),
          },
        ]),
    },
  };
};
