import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { DownloadItem, Episode, Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { EmptyState } from '../../../shared/components';
import { Icon, Screen, ScreenHeader, SearchField, Text, scrimScrollHandler } from '../../../ui';
import {
  useFollowedShows,
  usePlaylists,
  useSavedEpisodes,
  useShowsQuery,
  userPlaylists,
} from '../../../query';
import { NewPlaylistCard, PlaylistCard } from '../../playlists/components/PlaylistCard';
import { PlaylistEditorSheet } from '../../playlists/components/PlaylistEditorSheet';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useDownloads } from '../../downloads/useDownloads';
import { SectionHeader } from '../../home/components/SectionHeader';
import { HScroll } from '../../home/components/HScroll';
import { ShowCard } from '../../home/components/ShowCard';
import { EpisodeMiniCard } from '../../home/components/EpisodeMiniCard';

const trLower = (s: string) => s.toLocaleLowerCase('tr-TR');

/**
 * İndirme kaydından çalınabilir bölüm üretir.
 *
 * `audioUrl` kayıttan gelir: indirme silinse bile bölüm uzaktan çalınabilsin ve
 * yeniden indirilebilsin diye uzak adres indirme kaydında saklanır.
 */
const downloadToEpisode = (d: DownloadItem): Episode => ({
  id: d.episodeId,
  showId: d.showId ?? '',
  title: d.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: d.audioUrl ?? '',
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
  const playlists = usePlaylists();
  const { items, hydrate } = useDownloads();
  const [editorOpen, setEditorOpen] = useState(false);

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

  // Kullanıcının kendi listeleri (sistem listesi hariç), arama filtresine tabi.
  const myPlaylists = userPlaylists(playlists.data).filter(
    p => !query || trLower(p.name).includes(query),
  );

  // "Listelerim" şeridi her zaman görünür (yeni liste kısayolu için), bu yüzden
  // boşluk kararında sayılmaz.
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

      {empty && myPlaylists.length === 0 && query ? (
        <EmptyState title="Sonuç yok" description={`"${q}" için bir şey bulunamadı.`} />
      ) : (
        <ScrollView
          onScroll={scrimScrollHandler}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingVertical: theme.spacing(1), paddingBottom: theme.spacing(10) }}>
          {/* 1. Sonra dinle (sistem listesi) */}
          {savedList.length > 0 && (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <SectionHeader
                title="Sonra dinle"
                onSeeAll={() =>
                  navigation.navigate('SeeAll', { kind: 'saved', title: 'Sonra dinle' })
                }
              />
              <HScroll>
                {savedList.map(ep => (
                  <EpisodeMiniCard
                    key={ep.id}
                    artworkUrl={ep.imageUrl}
                    title={ep.title}
                    subtitle={showTitleOf(ep.showId)}
                    publishedAt={ep.publishedAt}
                    durationSec={ep.durationSec}
                    onPress={() => play(ep)}
                  />
                ))}
              </HScroll>
            </View>
          )}

          {/* 2. İndirilenler */}
          {downloadsList.length > 0 && (
            <View style={{ marginBottom: theme.spacing(2.5) }}>
              <SectionHeader
                title="İndirilenler"
                onSeeAll={() => navigation.navigate('Downloads')}
              />
              <HScroll>
                {downloadsList.map(ep => (
                  <EpisodeMiniCard
                    key={ep.id}
                    artworkUrl={ep.imageUrl}
                    title={ep.title}
                    subtitle={showTitleOf(ep.showId)}
                    // İndirilenlerde ekstra bilgi: rozet + tarih·süre.
                    badge={{ icon: 'downloaded', label: 'İndirildi' }}
                    publishedAt={ep.publishedAt}
                    durationSec={ep.durationSec}
                    onPress={() => play(ep)}
                  />
                ))}
              </HScroll>
            </View>
          )}

          {/* 3. Kendi listelerim — her zaman görünür ("+" ile yeni liste). */}
          <View style={{ marginBottom: theme.spacing(2.5) }}>
            <SectionHeader
              title="Listelerim"
              onSeeAll={
                myPlaylists.length > 0
                  ? () => navigation.navigate('SeeAll', { kind: 'playlists', title: 'Listelerim' })
                  : undefined
              }
            />
            {empty && myPlaylists.length === 0 && (
              <Text
                variant="caption"
                color={theme.colors.textMuted}
                style={{ paddingHorizontal: theme.spacing(2), paddingBottom: theme.spacing(1) }}>
                Kendi listelerini oluştur, bölümleri istediğin gibi topla.
              </Text>
            )}
            <HScroll>
              <NewPlaylistCard onPress={() => setEditorOpen(true)} />
              {myPlaylists.map(playlist => (
                <PlaylistCard
                  key={playlist.id}
                  playlist={playlist}
                  onPress={() =>
                    navigation.navigate('PlaylistDetail', { playlistId: playlist.id })
                  }
                />
              ))}
            </HScroll>
          </View>

          {/* 4. Takip ettiğin şovlar */}
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
        </ScrollView>
      )}

      <PlaylistEditorSheet visible={editorOpen} onClose={() => setEditorOpen(false)} />
    </Screen>
  );
};
