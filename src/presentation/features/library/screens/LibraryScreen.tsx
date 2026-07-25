import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DownloadItem, Episode, Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { EmptyState } from '../../../shared/components';
import { Icon, Screen, ScreenHeader, SearchField } from '../../../ui';
import { useFollowedShows, useSavedEpisodes, useShowsQuery } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useDownloads } from '../../downloads/useDownloads';
import { SectionHeader } from '../../home/components/SectionHeader';
import { HScroll } from '../../home/components/HScroll';
import { ShowCard } from '../../home/components/ShowCard';
import { EpisodeCard } from '../../home/components/EpisodeCard';

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');

const downloadToEpisode = (d: DownloadItem): Episode => ({
  id: d.episodeId,
  showId: d.showId ?? '',
  title: d.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: '',
  durationSec: d.durationSec ?? 0,
  publishedAt: d.publishedAt ?? '',
  imageUrl: d.artworkUrl,
});

/**
 * LibraryScreen — Kütüphane. Ana sayfa gibi yatay carousel'ler:
 * Sonra dinle · Takip ettiğin şovlar · İndirilenler. Üstte kütüphane-içi arama.
 */
export const LibraryScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();
  const [q, setQ] = useState('');

  const shows = useShowsQuery();
  const followed = useFollowedShows();
  const saved = useSavedEpisodes();
  const { items, hydrate } = useDownloads();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const showTitleOf = useMemo(() => {
    const map = new Map<string, Show>();
    (shows.data ?? []).forEach(s => map.set(s.id, s));
    return (showId: string) => map.get(showId)?.title ?? '';
  }, [shows.data]);

  const query = trLower(q.trim());
  const matchEp = (e: Episode) =>
    !query || trLower(e.title).includes(query) || trLower(showTitleOf(e.showId)).includes(query);
  const matchShow = (s: Show) =>
    !query || trLower(s.title).includes(query) || trLower(s.author).includes(query);

  const savedList = (saved.data ?? []).filter(matchEp);
  const followedList = (followed.data ?? []).filter(matchShow);
  const downloadsList = Object.values(items)
    .filter(d => d.status === 'downloaded')
    .map(downloadToEpisode)
    .filter(matchEp);

  const openShow = (show: Show) =>
    navigation.navigate('ShowDetail', {
      showId: show.id,
      feedUrl: show.feedUrl,
      title: show.title,
    });

  const empty = savedList.length === 0 && followedList.length === 0 && downloadsList.length === 0;
  // Kütüphanede hiç içerik yok mu (filtreden önce)? Öyleyse arama kutusunu gizle
  // ki "boş" mesajı ekranın tam ortasına gelsin.
  const hasAnyLibrary =
    (saved.data?.length ?? 0) > 0 ||
    (followed.data?.length ?? 0) > 0 ||
    Object.values(items).some(d => d.status === 'downloaded');

  return (
    <Screen>
      <ScreenHeader
        title="Kütüphane"
        right={
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Ayarlar">
            <Icon name="settings" size={24} color={theme.colors.text} />
          </Pressable>
        }
      />
      {hasAnyLibrary && <SearchField value={q} onChangeText={setQ} placeholder="Kütüphanende ara" />}

      {empty ? (
        <EmptyState
          title={query ? 'Sonuç yok' : 'Kütüphanen boş'}
          description={
            query
              ? `"${q}" için bir şey bulunamadı.`
              : 'Şov takip et, bölüm indir ya da "Sonra dinle"ye ekle.'
          }
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingVertical: theme.spacing(1), paddingBottom: theme.spacing(10) }}>
          {savedList.length > 0 && (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <SectionHeader title="Sonra dinle" />
              <HScroll>
                {savedList.map(ep => (
                  <EpisodeCard
                    key={ep.id}
                    episode={ep}
                    showTitle={showTitleOf(ep.showId)}
                    onPress={() => play(ep)}
                  />
                ))}
              </HScroll>
            </View>
          )}

          {followedList.length > 0 && (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <SectionHeader title="Takip ettiğin şovlar" />
              <HScroll>
                {followedList.map(s => (
                  <ShowCard key={s.id} show={s} onPress={() => openShow(s)} />
                ))}
              </HScroll>
            </View>
          )}

          {downloadsList.length > 0 && (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <SectionHeader title="İndirilenler" />
              <HScroll>
                {downloadsList.map(ep => (
                  <EpisodeCard
                    key={ep.id}
                    episode={ep}
                    showTitle={showTitleOf(ep.showId)}
                    onPress={() => play(ep)}
                  />
                ))}
              </HScroll>
            </View>
          )}
        </ScrollView>
      )}
    </Screen>
  );
};
