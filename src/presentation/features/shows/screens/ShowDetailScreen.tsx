import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { FlashList } from '@shopify/flash-list';
import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Episode } from '@domain/entities';
import { useTheme } from '../../../theme';
import { CoverGradient, CoverImage, Icon, Text, TextSheet, scrimScrollHandler, useHeroCoverSize } from '../../../ui';
import { useResumeList, useShowEpisodes } from '../../../query';
import { useIsFollowed, useToggleFollow } from '../../../query';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useEpisodeSheetStore } from '../../../stores';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import type { RootStackParamList } from '../../../navigation/types';
import { EpisodeRow } from '../components/EpisodeRow';

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

  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useShowEpisodes(feedUrl);
  const resume = useResumeList();
  const followed = useIsFollowed(showId);
  const toggleFollow = useToggleFollow();

  const episodes = useMemo(
    () => data?.pages.flatMap(p => p.episodes.items) ?? [],
    [data],
  );
  const show = data?.pages[0]?.show;

  // Kaldığın-yer çubukları için episodeId → oran haritası.
  const progressById = useMemo(() => {
    const map = new Map<string, number>();
    (resume.data ?? []).forEach(p => {
      if (p.durationSec > 0) {
        map.set(p.episodeId, p.positionSec / p.durationSec);
      }
    });
    return map;
  }, [resume.data]);

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
    </View>
  );

  if (episodes.length === 0) {
    return wrap(
      <>
        {Header}
        <EmptyState title="Bölüm yok" description="Bu şovda henüz yayınlanmış bölüm bulunmuyor." />
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
        <EpisodeRow
          episode={item}
          progress={progressById.get(item.id)}
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
