import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, View } from 'react-native';
import { formatDuration, stripHtml } from '@core/utils';
import { useTheme } from '../../theme';
import { BottomSheet, CoverImage, Icon, IconName, Text } from '../../ui';
import { useSavedEpisodes, useShowsQuery, useToggleSaved } from '../../query';
import { useEpisodeSheetStore } from '../../stores';
import { usePlayEpisode } from '../player/usePlayEpisode';
import { useDownloads, useDownloadStatus } from '../downloads/useDownloads';

const formatDate = (iso: string): string => {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * EpisodeSheet — bölüm ayrıntı paneli (aşağı kaydırıp kapatılan panel).
 * Kök seviyede tek örnek; episodeSheetStore ile açılır/kapanır. Buradan
 * çal / sonra dinle / indir / paylaş yapılır.
 */
export const EpisodeSheet: React.FC = () => {
  const theme = useTheme();
  const episode = useEpisodeSheetStore(s => s.episode);
  const close = useEpisodeSheetStore(s => s.close);
  const play = usePlayEpisode();
  const { start, remove } = useDownloads();
  const status = useDownloadStatus(episode?.id ?? '');
  const shows = useShowsQuery();
  const saved = useSavedEpisodes();
  const toggleSaved = useToggleSaved();
  const isSaved = (saved.data ?? []).some(e => e.id === episode?.id);

  const showTitle =
    (shows.data ?? []).find(s => s.id === episode?.showId)?.title ?? '';

  const download: {
    icon: IconName;
    label: string;
    onPress?: () => void;
    color?: string;
    busy?: boolean;
  } = (() => {
    if (!episode) {
      return { icon: 'download', label: 'İndir' };
    }
    if (status === 'downloaded') {
      return {
        icon: 'downloaded',
        label: 'İndirildi',
        onPress: () => remove(episode.id),
        color: theme.colors.accent,
      };
    }
    if (status === 'downloading') {
      return { icon: 'download', label: 'İndiriliyor…', busy: true };
    }
    return { icon: 'download', label: 'İndir', onPress: () => start(episode) };
  })();

  return (
    <BottomSheet visible={!!episode} onClose={close}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing(2.5), paddingTop: theme.spacing(1) }}>
        {episode && (
          <>
            <View style={{ flexDirection: 'row', gap: theme.spacing(1.5) }}>
              <CoverImage uri={episode.imageUrl} size={72} radius={theme.radius.md} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label" color={theme.colors.accent} uppercase numberOfLines={1}>
                  {showTitle}
                </Text>
                <Text variant="heading" numberOfLines={3} style={{ marginTop: 2 }}>
                  {episode.title}
                </Text>
                <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
                  {formatDate(episode.publishedAt)} · {formatDuration(episode.durationSec)}
                </Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: theme.spacing(1.5), marginTop: theme.spacing(2) }}>
              <Pressable
                onPress={() => {
                  play(episode);
                  close();
                }}
                accessibilityRole="button"
                accessibilityLabel="Çal"
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  backgroundColor: theme.colors.accent,
                  paddingVertical: theme.spacing(1.5),
                  borderRadius: theme.radius.pill,
                }}>
                <Icon name="play" size={18} color={theme.colors.onAccent} />
                <Text variant="bodyStrong" color={theme.colors.onAccent}>
                  Çal
                </Text>
              </Pressable>

              <SheetAction
                icon={isSaved ? 'bookmark' : 'bookmark-outline'}
                label="Sonra dinle"
                color={isSaved ? theme.colors.accent : undefined}
                onPress={() => toggleSaved.mutate(episode)}
              />
              <SheetAction
                icon={download.icon}
                label={download.label}
                onPress={download.onPress}
                color={download.color}
                busy={download.busy}
              />
              <SheetAction
                icon="share"
                label="Paylaş"
                onPress={() =>
                  Share.share({ message: `${episode.title} — Anadolu Ajansı Podcast` }).catch(() => {})
                }
              />
            </View>

            {!!episode.description && (
              <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing(2.5) }}>
                {stripHtml(episode.description)}
              </Text>
            )}
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
};

const SheetAction: React.FC<{
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  busy?: boolean;
}> = ({ icon, label, onPress, color, busy }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingHorizontal: theme.spacing(1.5),
        opacity: onPress || busy ? 1 : 0.5,
      }}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.accent} style={{ height: 22 }} />
      ) : (
        <Icon name={icon} size={22} color={color ?? theme.colors.text} />
      )}
      <Text variant="caption" color={theme.colors.textMuted}>
        {label}
      </Text>
    </Pressable>
  );
};
