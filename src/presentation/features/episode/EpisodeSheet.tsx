import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Share, View } from 'react-native';
import { formatDuration, stripHtml } from '@core/utils';
import { useTheme } from '../../theme';
import { BottomSheet, CoverImage, Icon, IconName, Text } from '../../ui';
import { useEpisodeNotes, useSavedEpisodes, useShowsQuery, useToggleSaved } from '../../query';
import { useEpisodeSheetStore, usePlayerQueueStore } from '../../stores';
import { usePlayEpisode } from '../player/usePlayEpisode';
import { useDownloads, useDownloadStatus } from '../downloads/useDownloads';
import { AddToPlaylistSheet } from '../playlists/components/AddToPlaylistSheet';

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
  const [playlistOpen, setPlaylistOpen] = useState(false);
  const enqueue = usePlayerQueueStore(s => s.enqueue);
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
  // Notlar eksikse (ör. "Dinlemeye devam"dan gelen bölüm) feed'den zenginleştir.
  const notes = useEpisodeNotes(episode ?? undefined);

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

            {/* Aksiyon satırı — yalnızca simgeler. Çal belirgin (dolu daire),
                diğerleri eşit aralıkta. Etiketler erişilebilirlikte taşınır. */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: theme.spacing(2.5),
              }}>
              <Pressable
                onPress={() => {
                  play(episode);
                  close();
                }}
                accessibilityRole="button"
                accessibilityLabel="Çal"
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: theme.colors.accent,
                }}>
                {/* Üçgen optik olarak sola kayık durur; hafifçe sağa itilir. */}
                <View style={{ marginLeft: 2 }}>
                  <Icon name="play" size={24} color={theme.colors.onAccent} />
                </View>
              </Pressable>

              <SheetAction
                icon={isSaved ? 'bookmark' : 'bookmark-outline'}
                label={isSaved ? 'Sonra dinleden çıkar' : 'Sonra dinleye ekle'}
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
                icon="playlist"
                badge="add"
                label="Listeye ekle"
                onPress={() => setPlaylistOpen(true)}
              />
              <SheetAction
                icon="queue"
                badge="add"
                label="Sıraya ekle"
                onPress={() => {
                  enqueue(episode);
                  close();
                }}
              />
              <SheetAction
                icon="share"
                label="Paylaş"
                onPress={() =>
                  Share.share({ message: `${episode.title} — Anadolu Ajansı Podcast` }).catch(() => {})
                }
              />
            </View>

            {!!notes && (
              <Text variant="body" color={theme.colors.textMuted} style={{ marginTop: theme.spacing(2.5) }}>
                {stripHtml(notes)}
              </Text>
            )}
          </>
        )}
      </ScrollView>

      {/* Listeye ekle paneli — bölüm paneli açıkken üstte açılır. */}
      <AddToPlaylistSheet
        visible={playlistOpen}
        episode={episode}
        onClose={() => setPlaylistOpen(false)}
      />
    </BottomSheet>
  );
};

/**
 * SheetAction — panelin simge butonu.
 *
 * Etiket yalnızca erişilebilirlik için taşınır, ekranda gösterilmez; böylece
 * aksiyonlar tek satıra sığar ve düzen bozulmaz. `badge` verilirse simgenin sağ
 * altına küçük bir işaret eklenir (ör. "listeye ekle" için artı).
 */
const SheetAction: React.FC<{
  icon: IconName;
  label: string;
  onPress?: () => void;
  color?: string;
  busy?: boolean;
  badge?: IconName;
}> = ({ icon, label, onPress, color, busy, badge }) => {
  const theme = useTheme();
  const tint = color ?? theme.colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || busy}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={{
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: onPress || busy ? 1 : 0.5,
      }}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : (
        <View>
          <Icon name={icon} size={24} color={tint} />
          {badge && (
            <View
              style={{
                position: 'absolute',
                right: -6,
                bottom: -4,
                borderRadius: 8,
                backgroundColor: theme.colors.elevated,
              }}>
              <Icon name={badge} size={13} color={tint} />
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
};
