import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { BottomSheet, CoverImage, Icon, NowPlayingBars, Text } from '../../../ui';
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
  const removeAt = usePlayerQueueStore(s => s.removeAt);
  const current = usePlayerStore(s => s.currentEpisode);
  const playback = usePlayerStore(s => s.playback);
  const { play } = usePlaybackController();

  // Çalan bölüm + sonrasındakiler (geçmiş gösterilmez).
  const visibleQueue = index >= 0 ? episodes.slice(index) : current ? [current] : [];

  /** Kuyruktaki KONUMA atlar (aynı bölüm birden çok kez bulunabilir). */
  const jumpTo = (episode: Episode, position: number): void => {
    void play(episode, { episodes, index: position });
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
          {visibleQueue.map((item, i) => {
            // Kuyruk kopya içerebildiği için anahtar KONUMU da taşır.
            const position = (index >= 0 ? index : 0) + i;
            return (
              <QueueRow
                key={`${item.id}-${position}`}
                episode={item}
                active={i === 0}
                playing={playback.status === 'playing'}
                onPress={() => (i === 0 ? onClose() : jumpTo(item, position))}
                onRemove={i === 0 ? undefined : () => removeAt(position)}
              />
            );
          })}
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
  /** Verilirse satırın sağında kuyruktan çıkarma düğmesi görünür. */
  onRemove?: () => void;
}> = ({ episode, active, playing, onPress, onRemove }) => {
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
      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kuyruktan çıkar">
          <Icon name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      )}
    </Pressable>
  );
};
