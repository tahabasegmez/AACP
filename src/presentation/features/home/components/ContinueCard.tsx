import React from 'react';
import { Pressable, View } from 'react-native';
import { PlaybackProgress } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';

const DEFAULT_W = 236;

/**
 * ContinueCard — "Dinlemeye devam" kartı: kapak + bölüm/şov + kaldığın-yer çubuğu
 * + hızlı çal butonu. Meta veri progress kaydından gelir (feed çekmeye gerek yok).
 */
export const ContinueCard: React.FC<{
  progress: PlaybackProgress;
  showTitle: string;
  onPress: () => void;
  width?: number;
}> = ({ progress, showTitle, onPress, width = DEFAULT_W }) => {
  const theme = useTheme();
  const fraction =
    progress.durationSec > 0
      ? Math.min(1, progress.positionSec / progress.durationSec)
      : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${progress.episodeTitle ?? 'Bölüm'} — kaldığın yerden devam et`}
      style={{
        width,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing(1.25),
      }}>
      <CoverImage uri={progress.artworkUrl} size={54} radius={theme.radius.md} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="subtitle" numberOfLines={1}>
          {progress.episodeTitle ?? 'Bölüm'}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
          {showTitle}
        </Text>
        <View
          style={{
            height: 3,
            borderRadius: 2,
            backgroundColor: theme.colors.border,
            marginTop: theme.spacing(1),
            overflow: 'hidden',
          }}>
          <View
            style={{
              height: '100%',
              width: `${fraction * 100}%`,
              backgroundColor: theme.colors.accent,
            }}
          />
        </View>
      </View>
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          backgroundColor: theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="play" size={16} color={theme.colors.bg} />
      </View>
    </Pressable>
  );
};
