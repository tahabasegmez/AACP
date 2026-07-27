import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { BottomSheet, CoverImage, NowPlayingBars, Text } from '../../../ui';
import { usePlayerQueueStore, usePlayerStore } from '../../../stores';
import { usePlaybackController } from '../usePlaybackController';

/**
 * QueueSheet — "Sıradakiler" paneli.
 *
 * Ayrı bir ekran yerine ortak `BottomSheet` panelini kullanır (ekranın yarısına
 * kadar çıkar, başlıktan aşağı sürüklenince kapanır). Böylece uygulamadaki tüm
 * alttan açılan yüzeyler aynı bileşeni paylaşır.
 *
 * Çalan bölüm ayrı bir "şimdi çalıyor" başlığıyla değil, satırının sağındaki
 * animasyonlu ses çubuklarıyla belli edilir (Spotify davranışı).
 */
export const QueueSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const episodes = usePlayerQueueStore(s => s.episodes);
  const index = usePlayerQueueStore(s => s.index);
  const current = usePlayerStore(s => s.currentEpisode);
  const playback = usePlayerStore(s => s.playback);
  const { play } = usePlaybackController();

  // Çalan bölüm + sonrasındakiler (geçmiş gösterilmez).
  const visibleQueue = index >= 0 ? episodes.slice(index) : current ? [current] : [];

  const jumpTo = (episode: Episode): void => {
    const target = episodes.findIndex(e => e.id === episode.id);
    void play(episode, { episodes, index: target >= 0 ? target : 0 });
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightRatio={0.5}>
      {visibleQueue.length === 0 ? (
        <View style={{ padding: theme.spacing(3), alignItems: 'center' }}>
          <Text variant="body" color={theme.colors.textMuted}>
            Sırada bölüm yok
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing(2) }}>
          {visibleQueue.map((item, i) => (
            <QueueRow
              key={item.id}
              episode={item}
              active={i === 0}
              playing={playback.status === 'playing'}
              onPress={() => (i === 0 ? onClose() : jumpTo(item))}
            />
          ))}
        </ScrollView>
      )}
    </BottomSheet>
  );
};

/** Kuyruktaki tek satır; çalan satır ses çubuklarıyla işaretlenir. */
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
      accessibilityLabel={active ? `${episode.title} — çalıyor` : episode.title}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
        paddingHorizontal: theme.spacing(2),
        paddingVertical: theme.spacing(1),
      }}>
      <CoverImage uri={episode.imageUrl} size={44} radius={theme.radius.md} />
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
      {active && <NowPlayingBars playing={playing} />}
    </Pressable>
  );
};
