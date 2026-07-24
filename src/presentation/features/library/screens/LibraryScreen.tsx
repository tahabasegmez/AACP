import React, { useEffect } from 'react';
import { Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import { DownloadItem, Episode, Show } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import { CoverImage, Icon, Screen, Text } from '../../../ui';
import { useFollowedShows } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useDownloads } from '../../downloads/useDownloads';
import { ShowCard } from '../../home/components/ShowCard';

const downloadToEpisode = (d: DownloadItem): Episode => ({
  id: d.episodeId,
  showId: d.showId ?? '',
  title: d.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: '', // indirildi → PlayEpisode yerel dosyayı çözer
  durationSec: d.durationSec ?? 0,
  publishedAt: d.publishedAt ?? '',
  imageUrl: d.artworkUrl,
});

/**
 * LibraryScreen — Kütüphane: İndirilenler + takip edilen şovlar.
 * (Geçmiş ve "Sonra dinle" sonraki aşamalarda.)
 */
export const LibraryScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const { width } = useWindowDimensions();
  const followed = useFollowedShows();
  const play = usePlayEpisode();
  const { items, hydrate, remove } = useDownloads();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const downloads = Object.values(items).filter(d => d.status === 'downloaded');

  const pad = theme.spacing(2);
  const gap = theme.spacing(1.5);
  const colW = Math.floor((width - pad * 2 - gap) / 2);

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  const FollowedSection = () => {
    if (followed.isLoading) {
      return <LoadingView />;
    }
    if (followed.isError) {
      return <ErrorView error={followed.error} onRetry={followed.refetch} />;
    }
    const shows = followed.data ?? [];
    if (shows.length === 0) {
      return (
        <EmptyState
          title="Henüz takip yok"
          description="Bir şovu takip et; buradan ve ana sayfadan hızlıca ulaş."
        />
      );
    }
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, paddingHorizontal: pad }}>
        {shows.map(s => (
          <ShowCard key={s.id} show={s} width={colW} onPress={() => openShow(s)} />
        ))}
      </View>
    );
  };

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: pad,
          paddingBottom: theme.spacing(1),
        }}>
        <Text variant="title">Kütüphane</Text>
        <Pressable
          onPress={() => navigation.navigate('Tabs', { screen: 'Search' })}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Şov ara">
          <Icon name="search" size={24} color={theme.colors.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing(10) }}>
        {downloads.length > 0 && (
          <View style={{ marginBottom: theme.spacing(2.5) }}>
            <Text variant="heading" style={{ paddingHorizontal: pad, marginBottom: theme.spacing(1) }}>
              İndirilenler
            </Text>
            {downloads.map(d => (
              <View
                key={d.episodeId}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing(1.25),
                  paddingHorizontal: pad,
                  paddingVertical: theme.spacing(1),
                }}>
                <CoverImage uri={d.artworkUrl} size={46} radius={theme.radius.sm} />
                <Pressable
                  onPress={() => play(downloadToEpisode(d))}
                  style={{ flex: 1, minWidth: 0 }}
                  accessibilityRole="button"
                  accessibilityLabel={`${d.episodeTitle} çal`}>
                  <Text variant="subtitle" numberOfLines={1}>
                    {d.episodeTitle}
                  </Text>
                  <Text variant="caption" color={theme.colors.textMuted}>
                    {formatDuration(d.durationSec ?? 0)} · indirildi
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => remove(d.episodeId)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="İndirmeyi sil">
                  <Icon name="close" size={20} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <Text variant="heading" style={{ paddingHorizontal: pad, marginBottom: theme.spacing(1.5) }}>
          Takip ettiğin şovlar
        </Text>
        <FollowedSection />
      </ScrollView>
    </Screen>
  );
};
