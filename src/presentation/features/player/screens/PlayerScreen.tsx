import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';

/**
 * PlayerScreen — "Şimdi Çalıyor" ekranı.
 *
 * GEÇİCİ/SADE arayüz: yalnızca oynatma zincirini (çal, duraklat, ileri/geri) cihazda
 * doğrulamak için. Spotify'dan esinlenilmiş tasarım sonraki fazda bunun yerine gelecek.
 *
 * Durumu playerStore'dan okur; kontroller domain use case'leri üzerinden çalışır
 * (oynatıcı kütüphanesini doğrudan çağırmaz) — CarPlay ile aynı giriş noktaları.
 */
export const PlayerScreen: React.FC = () => {
  const theme = useTheme();
  const { pausePlayback, resumePlayback, skipBy } = useDependencies();
  const { playback, currentEpisode } = usePlayerStore();

  const isPlaying = playback.status === 'playing';

  const controlStyle = { marginTop: theme.spacing(3) };
  const controlText = { color: theme.colors.primary, fontSize: 16 };

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
        {formatDuration(playback.positionSec)} /{' '}
        {formatDuration(playback.durationSec)}
      </Text>
      <Text style={{ color: theme.colors.textMuted }}>Durum: {playback.status}</Text>

      <Pressable
        onPress={() =>
          isPlaying ? pausePlayback.execute() : resumePlayback.execute()
        }
        style={controlStyle}>
        <Text style={controlText}>{isPlaying ? 'Duraklat' : 'Devam Et'}</Text>
      </Pressable>

      <Pressable
        onPress={() => skipBy.execute({ offsetSec: -15 })}
        style={controlStyle}>
        <Text style={controlText}>15 sn geri</Text>
      </Pressable>

      <Pressable
        onPress={() => skipBy.execute({ offsetSec: 30 })}
        style={controlStyle}>
        <Text style={controlText}>30 sn ileri</Text>
      </Pressable>
    </View>
  );
};
