import React, { useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Share,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDuration, stripHtml } from '@core/utils';
import { useTheme } from '../../../theme';
import {
  CoverGradient,
  CoverImage,
  Icon,
  IconName,
  Seekbar,
  Text,
  TextSheet,
  useHeroCoverSize,
} from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlayerStore, useSleepTimerStore } from '../../../stores';
import { useIsFollowed, useToggleFollow } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlaybackController } from '../usePlaybackController';
import { useDownloads, useDownloadStatus } from '../../downloads/useDownloads';
import { SkipButton } from '../components/SkipButton';

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];
const SLEEP_OPTIONS: ReadonlyArray<{ label: string; minutes: number }> = [
  { label: 'Kapalı', minutes: 0 },
  { label: '5 dakika', minutes: 5 },
  { label: '10 dakika', minutes: 10 },
  { label: '15 dakika', minutes: 15 },
  { label: '30 dakika', minutes: 30 },
  { label: '45 dakika', minutes: 45 },
  { label: '60 dakika', minutes: 60 },
];

/**
 * PlayerScreen — tam ekran "Şimdi Çalıyor".
 * Düzen: üstte oynatıcı (kapak, seek, transport), ortada bölüm notları düğmesi,
 * altta ikincil araçlar (hız, uyku, kuyruk, indir, cihaz, paylaş).
 */
export const PlayerScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { pausePlayback, resumePlayback, seekTo, setPlaybackRate } = useDependencies();
  const { next, previous } = usePlaybackController();
  const { start: startDownload } = useDownloads();

  const playback = usePlayerStore(s => s.playback);
  const episode = usePlayerStore(s => s.currentEpisode);
  const followed = useIsFollowed(episode?.showId ?? '');
  const toggleFollow = useToggleFollow();
  const dlStatus = useDownloadStatus(episode?.id ?? '');

  const sleepEndsAt = useSleepTimerStore(s => s.endsAt);
  const setSleepEndsAt = useSleepTimerStore(s => s.setEndsAt);

  const [notesOpen, setNotesOpen] = useState(false);
  const [hint, setHint] = useState('');

  const isPlaying = playback.status === 'playing';
  const isBusy = playback.status === 'loading' || playback.status === 'buffering';

  const showHint = (label: string) => {
    setHint(label);
    setTimeout(() => setHint(''), 1600);
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(playback.rate);
    setPlaybackRate.execute({ rate: SPEEDS[(idx + 1) % SPEEDS.length] });
  };

  const applySleep = (minutes: number) =>
    setSleepEndsAt(minutes > 0 ? Date.now() + minutes * 60_000 : null);

  const openSleepTimer = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Uyku zamanlayıcı',
          options: [...SLEEP_OPTIONS.map(o => o.label), 'İptal'],
          cancelButtonIndex: SLEEP_OPTIONS.length,
        },
        i => {
          if (i < SLEEP_OPTIONS.length) {
            applySleep(SLEEP_OPTIONS[i].minutes);
          }
        },
      );
    } else {
      Alert.alert('Uyku zamanlayıcı', undefined, [
        ...SLEEP_OPTIONS.map(o => ({ text: o.label, onPress: () => applySleep(o.minutes) })),
        { text: 'İptal', style: 'cancel' as const },
      ]);
    }
  };

  const sleepRemainingMin =
    sleepEndsAt != null ? Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 60_000)) : null;

  const onDownload = () => {
    if (!episode) return;
    if (dlStatus === 'downloaded') {
      showHint('İndirildi');
    } else if (dlStatus !== 'downloading') {
      startDownload(episode);
    }
  };

  const getPosition = () => usePlayerStore.getState().playback.positionSec;
  const getDuration = () => usePlayerStore.getState().playback.durationSec;
  const doSeek = (sec: number) => seekTo.execute({ positionSec: sec });
  const coverSize = useHeroCoverSize();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Arka plan: kapağın baskın renginden tema zeminine degrade */}
      <CoverGradient uri={episode?.imageUrl} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingHorizontal: theme.spacing(3) }}>
        {/* Üst bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Kapat">
            <Icon name="chevron-down" size={26} color={theme.colors.text} />
          </Pressable>
          <Text variant="label" color={theme.colors.text} uppercase numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
            AA PODCAST
          </Text>
          <Pressable onPress={() => showHint('Yakında: Seçenekler')} hitSlop={10} accessibilityLabel="Seçenekler">
            <Icon name="ellipsis" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Kapak: AA PODCAST ile başlık arasında ortalanır (kalan alanı doldurur) */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <CoverImage uri={episode?.imageUrl} size={coverSize} radius={theme.radius.lg} />
        </View>

        {/* Alt küme — sabit düzen (her bölümde aynı) */}
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(1.5) }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="heading" numberOfLines={2}>
                {episode?.title ?? 'Bölüm seçili değil'}
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

          <View style={{ marginTop: theme.spacing(2) }}>
            <Seekbar
              positionSec={playback.positionSec}
              durationSec={playback.durationSec}
              buffering={playback.status === 'buffering'}
              onSeek={doSeek}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text variant="caption" color={theme.colors.textMuted}>{formatDuration(playback.positionSec)}</Text>
              <Text variant="caption" color={theme.colors.textMuted}>{formatDuration(playback.durationSec)}</Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(3.5), marginTop: theme.spacing(1) }}>
            <SkipButton direction="back" onTap={() => previous(playback.positionSec)} onSeekTo={doSeek} getPosition={getPosition} getDuration={getDuration} />
            <Pressable
              onPress={() => (isPlaying ? pausePlayback.execute() : resumePlayback.execute())}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'}
              style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' }}>
              {isBusy ? (
                <ActivityIndicator color={theme.colors.bg} />
              ) : (
                <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={theme.colors.bg} />
              )}
            </Pressable>
            <SkipButton direction="forward" onTap={next} onSeekTo={doSeek} getPosition={getPosition} getDuration={getDuration} />
          </View>

          {(sleepRemainingMin != null && sleepRemainingMin > 0) || hint ? (
            <Text variant="caption" color={hint ? theme.colors.textMuted : theme.colors.accent} style={{ textAlign: 'center', marginTop: theme.spacing(1) }}>
              {hint || `Uyku zamanlayıcı: ~${sleepRemainingMin} dk`}
            </Text>
          ) : null}

          {/* Bölüm notları — başlat/butonlar ile alt araçlar arasında, önizlemeli */}
          {!!episode?.description && (
            <Pressable onPress={() => setNotesOpen(true)} style={{ marginTop: theme.spacing(1.75) }}>
              <Text variant="caption" color={theme.colors.textMuted} numberOfLines={2}>
                {stripHtml(episode.description)}
              </Text>
              <Text variant="caption" color={theme.colors.text} style={{ marginTop: 2 }}>
                devamını oku…
              </Text>
            </Pressable>
          )}

          {/* Araçlar — en altta */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing(2) }}>
            <Pressable
              onPress={cycleSpeed}
              hitSlop={8}
              accessibilityLabel={`Oynatma hızı ${playback.rate}x`}
              style={{ backgroundColor: theme.colors.accentSoft, paddingVertical: 6, paddingHorizontal: theme.spacing(1.5), borderRadius: theme.radius.pill }}>
              <Text variant="subtitle" color={theme.colors.accent}>{playback.rate}×</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: theme.spacing(2.5) }}>
              <Tool icon="timer" label="Uyku" active={sleepEndsAt != null} onPress={openSleepTimer} />
              <Tool icon="list" label="Kuyruk" onPress={() => showHint('Yakında: Kuyruk')} />
              <Tool
                icon={dlStatus === 'downloaded' ? 'downloaded' : 'download'}
                label="İndir"
                active={dlStatus === 'downloaded'}
                busy={dlStatus === 'downloading'}
                onPress={onDownload}
              />
              <Tool icon="cast" label="Cihaz" onPress={() => showHint('Yakında: Cihaz')} />
              <Tool icon="share" label="Paylaş" onPress={() => episode && Share.share({ message: `${episode.title} — Anadolu Ajansı Podcast` }).catch(() => {})} />
            </View>
          </View>
        </View>
      </View>

      <TextSheet
        visible={notesOpen}
        title="Bölüm notları"
        text={episode?.description ?? ''}
        onClose={() => setNotesOpen(false)}
      />
    </View>
  );
};

const Tool: React.FC<{
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  busy?: boolean;
}> = ({ icon, label, onPress, active, busy }) => {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : (
        <Icon name={icon} size={22} color={active ? theme.colors.accent : theme.colors.textMuted} />
      )}
    </Pressable>
  );
};
