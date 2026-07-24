import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';
import { useShowsQuery } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';

/**
 * MiniPlayer — tab bar'ın hemen üstünde sabit, o an çalan bölümü gösterir.
 * Dokununca tam ekran Player'ı açar (native slide-up). Bölüm yoksa görünmez.
 */
export const MiniPlayer: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const { pausePlayback, resumePlayback } = useDependencies();
  const playback = usePlayerStore(s => s.playback);
  const currentEpisode = usePlayerStore(s => s.currentEpisode);
  const shows = useShowsQuery();

  const showTitle = useMemo(() => {
    if (!currentEpisode) {
      return '';
    }
    const map = new Map<string, Show>();
    (shows.data ?? []).forEach(s => map.set(s.id, s));
    return map.get(currentEpisode.showId)?.title ?? '';
  }, [currentEpisode, shows.data]);

  if (!currentEpisode || playback.status === 'idle') {
    return null;
  }

  const isPlaying = playback.status === 'playing';
  const fraction =
    playback.durationSec > 0
      ? Math.min(1, playback.positionSec / playback.durationSec)
      : 0;

  return (
    <Pressable
      onPress={() => navigation.navigate('Player', { episodeId: currentEpisode.id })}
      accessibilityRole="button"
      accessibilityLabel={`${currentEpisode.title} — oynatıcıyı aç`}>
      <LinearGradient
        colors={[theme.colors.elevated, theme.colors.surface]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{
          marginHorizontal: theme.spacing(1),
          borderRadius: theme.radius.md,
          padding: theme.spacing(1),
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(1.25),
        }}>
        <CoverImage uri={currentEpisode.imageUrl} size={40} radius={theme.radius.sm} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="subtitle" numberOfLines={1}>
            {currentEpisode.title}
          </Text>
          {!!showTitle && (
            <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
              {showTitle}
            </Text>
          )}
        </View>
        <Pressable
          onPress={() => (isPlaying ? pausePlayback.execute() : resumePlayback.execute())}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={isPlaying ? 'Duraklat' : 'Devam et'}>
          <Icon name={isPlaying ? 'pause' : 'play'} size={26} color={theme.colors.text} />
        </Pressable>
      </LinearGradient>
      {/* ince ilerleme çizgisi */}
      <View
        style={{
          height: 2,
          marginHorizontal: theme.spacing(2),
          marginTop: 3,
          backgroundColor: theme.colors.border,
          borderRadius: 2,
          overflow: 'hidden',
        }}>
        <View style={{ height: '100%', width: `${fraction * 100}%`, backgroundColor: theme.colors.accent }} />
      </View>
    </Pressable>
  );
};
