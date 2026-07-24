import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Share, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, IconName, Seekbar, Text } from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';
import { useIsFollowed, useShowsQuery, useToggleFollow } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

const stripHtml = (html: string): string =>
  html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

/**
 * PlayerScreen — tam ekran "Şimdi Çalıyor". Kapaktan türeyen degrade, seek
 * (buffering göstergeli), ±15 sn, oynat/duraklat, hız, paylaş ve bölüm notları.
 * Kontroller domain use case'leri üzerinden (CarPlay ile aynı giriş noktaları).
 */
export const PlayerScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { pausePlayback, resumePlayback, seekTo, skipBy, setPlaybackRate } = useDependencies();

  const playback = usePlayerStore(s => s.playback);
  const episode = usePlayerStore(s => s.currentEpisode);
  const shows = useShowsQuery();
  const followed = useIsFollowed(episode?.showId ?? '');
  const toggleFollow = useToggleFollow();

  const [expandNotes, setExpandNotes] = useState(false);
  const [hint, setHint] = useState('');

  const showTitle =
    (shows.data ?? []).find(s => s.id === episode?.showId)?.title ?? '';
  const isPlaying = playback.status === 'playing';
  const isBusy = playback.status === 'loading' || playback.status === 'buffering';

  const showHint = (label: string) => {
    setHint(label);
    setTimeout(() => setHint(''), 1600);
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(playback.rate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setPlaybackRate.execute({ rate: next });
  };

  const onShare = () => {
    if (episode) {
      Share.share({ message: `${episode.title} — Anadolu Ajansı Podcast` }).catch(() => {});
    }
  };

  const Tool: React.FC<{ icon: IconName; label: string; onPress: () => void; active?: boolean }> = ({
    icon,
    label,
    onPress,
    active,
  }) => (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={label}>
      <Icon name={icon} size={22} color={active ? theme.colors.accent : theme.colors.textMuted} />
    </Pressable>
  );

  return (
    <LinearGradient
      colors={[theme.colors.brand, theme.colors.elevated, theme.colors.bg]}
      locations={[0, 0.5, 1]}
      style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}>
      {/* Üst bar */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing(2) }}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Kapat">
          <Icon name="chevron-down" size={26} color={theme.colors.text} />
        </Pressable>
        <Text variant="label" color={theme.colors.textMuted} uppercase numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
          {showTitle}
        </Text>
        <Pressable onPress={() => showHint('Yakında: Seçenekler')} hitSlop={10} accessibilityLabel="Seçenekler">
          <Icon name="ellipsis" size={22} color={theme.colors.text} />
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: theme.spacing(3) }}>
        <View style={{ alignItems: 'center', marginBottom: theme.spacing(4) }}>
          <CoverImage uri={episode?.imageUrl} size={260} radius={theme.radius.lg} />
        </View>

        {/* Başlık + takip */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(1.5) }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="heading" numberOfLines={2}>
              {episode?.title ?? 'Bölüm seçili değil'}
            </Text>
            <Text variant="subtitle" color={theme.colors.accent} style={{ marginTop: 2 }}>
              {showTitle}
            </Text>
          </View>
          {episode && (
            <Pressable
              onPress={() => toggleFollow.mutate(episode.showId)}
              hitSlop={10}
              accessibilityLabel={followed.data ? 'Takibi bırak' : 'Takip et'}>
              <Icon
                name={followed.data ? 'heart' : 'heart-outline'}
                size={26}
                color={followed.data ? theme.colors.accent : theme.colors.textMuted}
              />
            </Pressable>
          )}
        </View>

        {/* Seek */}
        <View style={{ marginTop: theme.spacing(2.5) }}>
          <Seekbar
            positionSec={playback.positionSec}
            durationSec={playback.durationSec}
            buffering={playback.status === 'buffering'}
            onSeek={sec => seekTo.execute({ positionSec: sec })}
          />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
            <Text variant="caption" color={theme.colors.textMuted}>
              {formatDuration(playback.positionSec)}
            </Text>
            <Text variant="caption" color={theme.colors.textMuted}>
              {formatDuration(playback.durationSec)}
            </Text>
          </View>
        </View>

        {/* Transport */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(3.5), marginTop: theme.spacing(1.5) }}>
          <Pressable onPress={() => skipBy.execute({ offsetSec: -15 })} hitSlop={10} accessibilityLabel="15 saniye geri">
            <Icon name="backward" size={30} color={theme.colors.text} />
          </Pressable>
          <Pressable
            onPress={() => (isPlaying ? pausePlayback.execute() : resumePlayback.execute())}
            accessibilityRole="button"
            accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'}
            style={{
              width: 68,
              height: 68,
              borderRadius: 34,
              backgroundColor: theme.colors.text,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            {isBusy ? (
              <ActivityIndicator color={theme.colors.bg} />
            ) : (
              <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={theme.colors.bg} />
            )}
          </Pressable>
          <Pressable onPress={() => skipBy.execute({ offsetSec: 30 })} hitSlop={10} accessibilityLabel="30 saniye ileri">
            <Icon name="forward" size={30} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Hız + araçlar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing(3) }}>
          <Pressable
            onPress={cycleSpeed}
            hitSlop={8}
            accessibilityLabel={`Oynatma hızı ${playback.rate}x`}
            style={{
              backgroundColor: theme.colors.accentSoft,
              paddingVertical: 6,
              paddingHorizontal: theme.spacing(1.5),
              borderRadius: theme.radius.pill,
            }}>
            <Text variant="subtitle" color={theme.colors.accent}>
              {playback.rate}×
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: theme.spacing(3) }}>
            <Tool icon="timer" label="Uyku zamanlayıcı" onPress={() => showHint('Yakında: Uyku zamanlayıcı')} />
            <Tool icon="list" label="Kuyruk" onPress={() => showHint('Yakında: Kuyruk')} />
            <Tool icon="download" label="İndir" onPress={() => showHint('Yakında: İndir')} />
            <Tool icon="cast" label="Oynatılan cihaz" onPress={() => showHint('Yakında: Cihaz seçimi')} />
            <Tool icon="share" label="Paylaş" onPress={onShare} />
          </View>
        </View>

        {!!hint && (
          <Text variant="caption" color={theme.colors.textMuted} style={{ textAlign: 'center', marginTop: theme.spacing(1.5) }}>
            {hint}
          </Text>
        )}

        {/* Bölüm notları */}
        {!!episode?.description && (
          <Pressable
            onPress={() => setExpandNotes(v => !v)}
            style={{
              marginTop: theme.spacing(2.5),
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius.md,
              padding: theme.spacing(1.75),
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text variant="subtitle">Bölüm notları</Text>
              <Icon name={expandNotes ? 'chevron-down' : 'chevron-right'} size={16} color={theme.colors.textMuted} />
            </View>
            <Text
              variant="caption"
              color={theme.colors.textMuted}
              numberOfLines={expandNotes ? undefined : 2}
              style={{ marginTop: theme.spacing(1) }}>
              {stripHtml(episode.description)}
            </Text>
          </Pressable>
        )}
      </View>
    </LinearGradient>
  );
};
