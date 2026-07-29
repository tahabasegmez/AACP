import React, { useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, ScrollView, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { BottomSheet, CoverImage, Icon, NowPlayingBars, Text } from '../../../ui';
import { usePlayerQueueStore, usePlayerStore } from '../../../stores';
import { usePlaybackController } from '../usePlaybackController';

/** Bir kuyruk satırının yüksekliği — sürükleme hesabı buna dayanır. */
const ROW_HEIGHT = 64;

/**
 * QueueSheet — "Sıradakiler" paneli.
 *
 * Ayrı bir ekran yerine ortak `BottomSheet` panelini kullanır (ekranın yarısına
 * kadar çıkar, başlıktan aşağı sürüklenince kapanır). Böylece uygulamadaki tüm
 * alttan açılan yüzeyler aynı bileşeni paylaşır.
 *
 * Çalan bölüm ayrı bir "şimdi çalıyor" başlığıyla değil, satırının sağındaki
 * animasyonlu ses çubuklarıyla belli edilir (Spotify davranışı).
 *
 * SIRALAMA: bir satıra uzun basıldığında sürükleme modu açılır; satır parmakla
 * yukarı/aşağı taşınır ve bırakıldığında kuyruk yeniden sıralanır.
 */
export const QueueSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const episodes = usePlayerQueueStore(s => s.episodes);
  const index = usePlayerQueueStore(s => s.index);
  const removeAt = usePlayerQueueStore(s => s.removeAt);
  const moveItem = usePlayerQueueStore(s => s.moveItem);
  const current = usePlayerStore(s => s.currentEpisode);
  const playback = usePlayerStore(s => s.playback);
  const { play } = usePlaybackController();

  /** Sürüklenen satırın kuyruktaki konumu; yoksa sürükleme yok. */
  const [dragging, setDragging] = useState<number | null>(null);
  /** Sürükleme sırasında kaç satır kaydırıldığı (canlı önizleme için). */
  const [offsetRows, setOffsetRows] = useState(0);

  // Çalan bölüm + sonrasındakiler (geçmiş gösterilmez).
  const start = index >= 0 ? index : 0;
  const visibleQueue = index >= 0 ? episodes.slice(index) : current ? [current] : [];

  const jumpTo = (episode: Episode, position: number): void => {
    void play(episode, { episodes, index: position });
    onClose();
  };

  const finishDrag = (from: number, rows: number): void => {
    const to = Math.max(start, Math.min(episodes.length - 1, from + rows));
    if (to !== from) {
      moveItem(from, to);
    }
    setDragging(null);
    setOffsetRows(0);
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
        <>
          <Text
            variant="caption"
            color={theme.colors.textDim}
            style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(0.75) }}>
            Sıralamayı değiştirmek için bir bölüme basılı tut ve sürükle
          </Text>
          {/* Sürükleme sırasında dikey kaydırma kilitlenir; yoksa jestler
              birbiriyle yarışır ve satır elden kaçar. */}
          <ScrollView
            scrollEnabled={dragging === null}
            contentContainerStyle={{ paddingBottom: theme.spacing(2) }}>
            {visibleQueue.map((item, i) => {
              // Kuyruk kopya içerebildiği için anahtar KONUMU da taşır.
              const position = start + i;
              const isDragged = dragging === position;

              // Sürüklenen satır taşınırken diğerleri yer açar.
              let shift = 0;
              if (dragging !== null && !isDragged) {
                const target = dragging + offsetRows;
                if (dragging < position && position <= target) {
                  shift = -1;
                } else if (target <= position && position < dragging) {
                  shift = 1;
                }
              }

              return (
                <QueueRow
                  key={`${item.id}-${position}`}
                  episode={item}
                  active={i === 0}
                  playing={playback.status === 'playing'}
                  dragging={isDragged}
                  shiftRows={shift}
                  onPress={() => (i === 0 ? onClose() : jumpTo(item, position))}
                  onRemove={i === 0 ? undefined : () => removeAt(position)}
                  onDragStart={() => setDragging(position)}
                  onDragMove={setOffsetRows}
                  onDragEnd={rows => finishDrag(position, rows)}
                />
              );
            })}
          </ScrollView>
        </>
      )}
    </BottomSheet>
  );
};

/** Kuyruktaki tek satır; çalan satır ses çubuklarıyla işaretlenir. */
const QueueRow: React.FC<{
  episode: Episode;
  active?: boolean;
  playing?: boolean;
  dragging?: boolean;
  /** Başka bir satır sürüklenirken bu satırın kaç satır kayacağı. */
  shiftRows?: number;
  onPress: () => void;
  onRemove?: () => void;
  onDragStart: () => void;
  onDragMove: (rows: number) => void;
  onDragEnd: (rows: number) => void;
}> = ({
  episode,
  active,
  playing,
  dragging,
  shiftRows = 0,
  onPress,
  onRemove,
  onDragStart,
  onDragMove,
  onDragEnd,
}) => {
  const theme = useTheme();
  const translateY = useRef(new Animated.Value(0)).current;
  // PanResponder bir kez kurulur; güncel değerleri ref üzerinden okur.
  const rowsRef = useRef(0);

  const pan = useRef(
    PanResponder.create({
      // Sürükleme YALNIZCA tutamaçtan başlar (uzun basma + sürükleme);
      // böylece satıra dokunmak hâlâ bölüme atlar.
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 4,
      onPanResponderGrant: () => {
        onDragStart();
      },
      onPanResponderMove: (_e, g) => {
        translateY.setValue(g.dy);
        const rows = Math.round(g.dy / ROW_HEIGHT);
        if (rows !== rowsRef.current) {
          rowsRef.current = rows;
          onDragMove(rows);
        }
      },
      onPanResponderRelease: () => {
        const rows = rowsRef.current;
        rowsRef.current = 0;
        translateY.setValue(0);
        onDragEnd(rows);
      },
      onPanResponderTerminate: () => {
        rowsRef.current = 0;
        translateY.setValue(0);
        onDragEnd(0);
      },
    }),
  ).current;

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
        paddingHorizontal: theme.spacing(2),
        height: ROW_HEIGHT,
        // Sürüklenen satır üstte ve hafif vurgulu durur.
        zIndex: dragging ? 10 : 0,
        opacity: dragging ? 0.95 : 1,
        backgroundColor: dragging ? theme.colors.surface : 'transparent',
        borderRadius: dragging ? theme.radius.md : 0,
        transform: [
          { translateY: dragging ? translateY : new Animated.Value(shiftRows * ROW_HEIGHT) },
          { scale: dragging ? 1.02 : 1 },
        ],
      }}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={active ? `${episode.title} — çalıyor` : episode.title}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: theme.spacing(1.25) }}>
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
      </Pressable>

      {active && <NowPlayingBars playing={playing} />}

      {onRemove && (
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Kuyruktan çıkar">
          <Icon name="close" size={18} color={theme.colors.textMuted} />
        </Pressable>
      )}

      {/* Sürükleme tutamacı — sıralama yalnızca buradan başlar. */}
      {onRemove && (
        <View
          {...pan.panHandlers}
          accessibilityLabel="Sırayı değiştirmek için sürükle"
          style={{ paddingHorizontal: 4, paddingVertical: 8 }}>
          <Icon name="list" size={18} color={theme.colors.textDim} />
        </View>
      )}
    </Animated.View>
  );
};
