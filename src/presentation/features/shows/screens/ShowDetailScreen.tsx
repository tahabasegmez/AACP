import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Episode } from '@domain/entities';
import { useTheme } from '../../../theme';
import {
  CoverGradient,
  CoverImage,
  Icon,
  SearchField,
  Text,
  TextSheet,
  scrimScrollHandler,
  useDebounced,
  useHeroCoverSize,
} from '../../../ui';
import { usePreference, useShowEpisodes } from '../../../query';
import { useIsFollowed, useToggleFollow } from '../../../query';
import { useProgressIndex } from '../../player/useEpisodeStatus';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useEpisodeSheetStore } from '../../../stores';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import type { RootStackParamList } from '../../../navigation/types';
import { SwipeableEpisodeRow } from '../../episode/SwipeableEpisodeRow';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowDetail'>;

/**
 * ShowDetailScreen — Spotify albüm mantığında şov ekranı.
 * Kapaktan türeyen degrade hero, Takip et, ve sayfalı bölüm listesi (FlashList).
 */
export const ShowDetailScreen: React.FC<Props> = ({ route }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { showId, feedUrl } = route.params;
  const play = usePlayEpisode();
  const openSheet = useEpisodeSheetStore(s => s.open);
  const coverSize = useHeroCoverSize();
  const [descOpen, setDescOpen] = useState(false);
  // Şov içi bölüm araması — sorgu sunucu/feed katmanında uygulanır, tüm
  // sayfalar arasında çalışır (yalnızca yüklenmiş sayfalarda değil).
  const [query, setQuery] = useState('');
  const search = useDebounced(query, 300);

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShowEpisodes(feedUrl, { search });
  const followed = useIsFollowed(showId);
  const toggleFollow = useToggleFollow();
  // Filtre tercihi cihazlar arası hatırlanır (misafirde de).
  const { value: hideCompleted, set: setHideCompleted } =
    usePreference('hideCompletedEpisodes');
  const { data: progressIndex } = useProgressIndex();

  const allEpisodes = useMemo(
    () => data?.pages.flatMap(p => p.episodes.items) ?? [],
    [data],
  );
  const show = data?.pages[0]?.show;

  const episodes = useMemo(
    () =>
      hideCompleted
        ? allEpisodes.filter(e => !progressIndex?.get(e.id)?.completed)
        : allEpisodes,
    [allEpisodes, hideCompleted, progressIndex],
  );

  const BackButton = (
    <Pressable
      onPress={() => navigation.goBack()}
      hitSlop={16}
      accessibilityRole="button"
      accessibilityLabel="Geri"
      style={{ position: 'absolute', top: insets.top + 6, left: theme.spacing(1.5), zIndex: 10 }}>
      <Icon name="chevron-back" size={28} color="#FFFFFF" />
    </Pressable>
  );

  const wrap = (body: React.ReactNode) => (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      {/* Sabit full-bleed backdrop: island dahil en üstten başlar, kapağın rengine göre */}
      <CoverGradient
        uri={show?.imageUrl}
        locations={[0, 0.4, 0.62]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {body}
      {BackButton}
      <TextSheet
        visible={descOpen}
        title={show?.title ?? 'Açıklama'}
        text={show?.description ?? ''}
        onClose={() => setDescOpen(false)}
      />
    </View>
  );

  if (isLoading) {
    return wrap(<LoadingView />);
  }
  if (isError) {
    return wrap(<ErrorView error={error} onRetry={refetch} />);
  }

  const Header = (
    <View>
      <View
        style={{
          paddingTop: insets.top + theme.spacing(6),
          paddingBottom: theme.spacing(2),
          alignItems: 'center',
        }}>
        <CoverImage uri={show?.imageUrl} size={coverSize} radius={theme.radius.md} />
        <Text variant="title" style={{ marginTop: theme.spacing(2), textAlign: 'center', paddingHorizontal: theme.spacing(2) }}>
          {show?.title ?? route.params.title ?? ''}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
          {show?.author}
          {show?.categories?.length ? ` · ${show.categories[0]}` : ''}
        </Text>
        {!!show?.description && (
          <Pressable onPress={() => setDescOpen(true)} style={{ paddingHorizontal: theme.spacing(2.5) }}>
            <Text
              variant="caption"
              color={theme.colors.textMuted}
              numberOfLines={3}
              style={{ textAlign: 'center', marginTop: theme.spacing(1.25) }}>
              {show.description}
            </Text>
            <Text variant="caption" color={theme.colors.text} style={{ textAlign: 'center', marginTop: 4 }}>
              devamını oku…
            </Text>
          </Pressable>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing(2.5), marginTop: theme.spacing(2) }}>
          <Pressable
            onPress={() => toggleFollow.mutate(showId)}
            accessibilityRole="button"
            accessibilityLabel={followed.data ? 'Takibi bırak' : 'Takip et'}
            style={{
              borderWidth: 1.5,
              borderColor: followed.data ? theme.colors.accent : theme.colors.textMuted,
              borderRadius: theme.radius.pill,
              paddingVertical: theme.spacing(1),
              paddingHorizontal: theme.spacing(2.25),
            }}>
            <Text variant="subtitle" color={followed.data ? theme.colors.accent : theme.colors.text}>
              {followed.data ? '✓ Takip ediliyor' : 'Takip et'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => episodes[0] && play(episodes[0], { episodes, index: 0 })}
            accessibilityRole="button"
            accessibilityLabel="En yeni bölümü çal"
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.accent,
            }}>
            <Icon name="play" size={24} color={theme.colors.onAccent} />
          </Pressable>
        </View>
      </View>

      {/* Bölüm listesinin hemen üstünde arama — uzun şovlarda gezinmeyi
          kolaylaştırır. Sorgu tüm bölümlerde çalışır, yalnızca yüklenmiş
          sayfalarda değil. */}
      <SearchField value={query} onChangeText={setQuery} placeholder="Bu şovda ara" />

      {/* Dinlenmişleri gizleme — seçim hatırlanır (cihazlar arası). */}
      <Pressable
        onPress={() => setHideCompleted(!hideCompleted)}
        accessibilityRole="switch"
        accessibilityState={{ checked: hideCompleted }}
        accessibilityLabel="Dinlenmiş bölümleri gizle"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: theme.spacing(0.75),
          marginTop: theme.spacing(1),
          paddingVertical: theme.spacing(0.75),
          paddingHorizontal: theme.spacing(1.25),
          borderRadius: theme.radius.md,
          borderWidth: 1,
          borderColor: hideCompleted ? theme.colors.accent : theme.colors.border,
          backgroundColor: hideCompleted ? theme.colors.accent : 'transparent',
        }}>
        <Icon
          name="checkmark"
          size={14}
          color={hideCompleted ? theme.colors.onAccent : theme.colors.textMuted}
        />
        <Text
          variant="caption"
          color={hideCompleted ? theme.colors.onAccent : theme.colors.textMuted}>
          Dinlenmişleri gizle
        </Text>
      </Pressable>
    </View>
  );

  if (episodes.length === 0) {
    return wrap(
      <>
        {Header}
        <EmptyState
          title={search ? 'Sonuç yok' : hideCompleted ? 'Hepsi dinlendi' : 'Bölüm yok'}
          description={
            search
              ? `"${search}" için bu şovda bölüm bulunamadı.`
              : hideCompleted
                ? 'Bu şovdaki tüm bölümleri dinledin. Filtreyi kapatarak hepsini görebilirsin.'
                : 'Bu şovda henüz yayınlanmış bölüm bulunmuyor.'
          }
        />
      </>,
    );
  }

  return wrap(
    <FlashList
      data={episodes}
      keyExtractor={item => item.id}
      ListHeaderComponent={Header}
      contentInsetAdjustmentBehavior="never"
      onScroll={scrimScrollHandler}
      scrollEventThrottle={16}
      contentContainerStyle={{ paddingBottom: theme.spacing(14) }}
      renderItem={({ item }: { item: Episode }) => (
        <SwipeableEpisodeRow
          episode={item}
          onPress={() => openSheet(item)}
          onPlay={() =>
            play(item, { episodes, index: episodes.findIndex(e => e.id === item.id) })
          }
        />
      )}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }}
    />,
  );
};
