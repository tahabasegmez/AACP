import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, Text } from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';
import { useShowsQuery } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';

const HEIGHT = 58;

/**
 * MiniPlayer — tab bar'ın hemen üstünde sabit, o an çalan bölümü gösterir.
 * Dokununca tam ekran Player'ı açar. Bölüm yoksa görünmez.
 * Sabit yükseklik + entegre (alt kenara gömülü) ilerleme çubuğu ile hizalı durur.
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
      accessibilityLabel={`${currentEpisode.title} — oynatıcıyı aç`}
      style={{
        height: HEIGHT,
        marginHorizontal: theme.spacing(1),
        borderRadius: theme.radius.md,
        backgroundColor: theme.colors.elevated,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: theme.spacing(1),
        paddingRight: theme.spacing(1.5),
        gap: theme.spacing(1.25),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: theme.colors.border,
      }}>
      <CoverImage uri={currentEpisode.imageUrl} size={42} radius={theme.radius.sm} />

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
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? 'Duraklat' : 'Devam et'}>
        <Icon name={isPlaying ? 'pause' : 'play'} size={26} color={theme.colors.text} />
      </Pressable>

      {/* Alt kenara gömülü ilerleme çubuğu */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 2.5,
          backgroundColor: theme.colors.border,
        }}>
        <View
          style={{
            height: '100%',
            width: `${fraction * 100}%`,
            backgroundColor: theme.colors.accent,
          }}
        />
      </View>
    </Pressable>
  );
};
