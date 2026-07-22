import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';

/**
 * PlayerScreen — "Şimdi Çalıyor" ekranı.
 *
 * Oynatma durumunu playerStore'dan okur; kontroller AudioPlayerService üzerinden
 * çalışır. Bu iskelet temel kontrolleri gösterir; tam tasarım sonra gelecek.
 */
export const PlayerScreen: React.FC = () => {
  const theme = useTheme();
  const { audioPlayer } = useDependencies();
  const { playback, currentEpisode } = usePlayerStore();

  const isPlaying = playback.status === 'playing';

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        padding: theme.spacing(3),
        justifyContent: 'center',
      }}>
      <Text style={{ color: theme.colors.text, fontSize: 18 }}>
        {currentEpisode?.title ?? 'Seçili bölüm yok'}
      </Text>
      <Text style={{ color: theme.colors.textMuted, marginTop: theme.spacing(1) }}>
        {formatDuration(playback.positionSec)} / {formatDuration(playback.durationSec)}
      </Text>
      <Pressable
        onPress={() => (isPlaying ? audioPlayer.pause() : audioPlayer.resume())}
        style={{ marginTop: theme.spacing(3) }}>
        <Text style={{ color: theme.colors.primary, fontSize: 16 }}>
          {isPlaying ? 'Duraklat' : 'Devam Et'}
        </Text>
      </Pressable>
    </View>
  );
};
