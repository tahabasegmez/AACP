import React from 'react';
import { Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, ImmersiveHeader, Text, scrimScrollHandler } from '../../../ui';
import { EmptyState } from '../../../shared/components';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlayerQueueStore, usePlayerStore } from '../../../stores';
import { usePlaybackController } from '../usePlaybackController';

/**
 * QueueScreen — "Sıradakiler": o an çalan bölüm ve kuyruğun devamı.
 *
 * Düzen Spotify'ın kuyruk ekranından esinlenir: üstte "Şimdi çalıyor", altında
 * "Sıradakiler" listesi. Bir satıra dokunmak o bölüme atlar (kuyruk korunur).
 *
 * Kuyruk `playerQueueStore`'dan okunur — çalma bağlamı neyse (şovun bölümleri
 * ya da tek bölüm) burada görünür.
 */
export const QueueScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const episodes = usePlayerQueueStore(s => s.episodes);
  const index = usePlayerQueueStore(s => s.index);
  const current = usePlayerStore(s => s.currentEpisode);
  const playback = usePlayerStore(s => s.playback);
  const { play } = usePlaybackController();

  // Çalan bölümden SONRAKİLER (geçmiş kuyrukta gösterilmez).
  const upcoming = index >= 0 ? episodes.slice(index + 1) : [];

  const jumpTo = (episode: Episode): void => {
    const target = episodes.findIndex(e => e.id === episode.id);
    void play(episode, { episodes, index: target >= 0 ? target : 0 });
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ImmersiveHeader title="Sıradakiler" onBack={() => navigation.goBack()} />

      {current && (
        <View style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(1.5) }}>
          <Text variant="label" color={theme.colors.accent} uppercase>
            Şimdi çalıyor
          </Text>
          <View style={{ marginTop: theme.spacing(1) }}>
            <QueueRow
              episode={current}
              active
              playing={playback.status === 'playing'}
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      )}

      {upcoming.length === 0 ? (
        <EmptyState
          title="Sırada bölüm yok"
          description="Bir şovdan bölüm çaldığında o şovun devamı burada sıraya girer."
        />
      ) : (
        <>
          <Text
            variant="label"
            color={theme.colors.textMuted}
            uppercase
            style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(1) }}>
            Sıradakiler
          </Text>
          <FlashList
            data={upcoming}
            keyExtractor={item => item.id}
            onScroll={scrimScrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: theme.spacing(12) }}
            renderItem={({ item }) => (
              <View style={{ paddingHorizontal: theme.spacing(2), paddingVertical: theme.spacing(0.75) }}>
                <QueueRow episode={item} onPress={() => jumpTo(item)} />
              </View>
            )}
          />
        </>
      )}
    </View>
  );
};

/** Kuyruktaki tek satır: kapak + başlık/süre; çalan satır vurgulanır. */
const QueueRow: React.FC<{
  episode: Episode;
  active?: boolean;
  playing?: boolean;
  onPress: () => void;
}> = ({ episode, active, playing, onPress }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={episode.title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
      }}>
      <CoverImage uri={episode.imageUrl} size={48} radius={theme.radius.md} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="subtitle"
          numberOfLines={2}
          color={active ? theme.colors.accent : theme.colors.text}>
          {episode.title}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
          {formatDuration(episode.durationSec)}
        </Text>
      </View>
      {active && (
        <Icon name={playing ? 'pause' : 'play'} size={20} color={theme.colors.accent} />
      )}
    </Pressable>
  );
};
