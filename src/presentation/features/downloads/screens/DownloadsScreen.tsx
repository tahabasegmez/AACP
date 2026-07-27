import React, { useMemo, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { DownloadItem, Episode, Show } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, ImmersiveHeader, Text, scrimScrollHandler } from '../../../ui';
import { EmptyState } from '../../../shared/components';
import { useShowsQuery } from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlayEpisode } from '../../player/usePlayEpisode';
import { useDownloads } from '../useDownloads';

/**
 * DownloadItem → çalınabilir Episode (meta indirme kaydında saklanır).
 * `audioUrl` kayıttan gelir; indirme silinse bile bölüm uzaktan çalınabilir.
 */
const toEpisode = (d: DownloadItem): Episode => ({
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
 * DownloadsScreen — indirilen bölümlerin yönetimi.
 *
 * Kütüphane'deki yatay "İndirilenler" listesinin tam hâli: her kaydın durumu
 * (indiriliyor / indirildi / başarısız) görünür, tek tek veya toplu silinebilir.
 * Silme geri alınamaz olduğu için onay istenir.
 */
export const DownloadsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useAppNavigation();
  const play = usePlayEpisode();
  const { items, remove } = useDownloads();
  const shows = useShowsQuery();
  const [busyId, setBusyId] = useState<string>();

  const showTitleOf = useMemo(() => {
    const map = new Map<string, Show>();
    (shows.data ?? []).forEach(s => map.set(s.id, s));
    return (showId?: string) => (showId ? map.get(showId)?.title ?? '' : '');
  }, [shows.data]);

  // En son indirilenler üstte; yayın tarihi yoksa sona düşer.
  const list = useMemo(
    () =>
      Object.values(items).sort((a, b) =>
        (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      ),
    [items],
  );

  const downloadedCount = list.filter(d => d.status === 'downloaded').length;

  const confirmRemove = (item: DownloadItem): void => {
    Alert.alert(
      'İndirmeyi sil',
      `"${item.episodeTitle ?? 'Bölüm'}" cihazdan silinecek. Bölümü daha sonra tekrar indirebilirsin.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            setBusyId(item.episodeId);
            void remove(item.episodeId).finally(() => setBusyId(undefined));
          },
        },
      ],
    );
  };

  const confirmRemoveAll = (): void => {
    Alert.alert(
      'Tüm indirmeleri sil',
      `${downloadedCount} bölüm cihazdan silinecek. Bu işlem geri alınamaz.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Tümünü sil',
          style: 'destructive',
          onPress: () => {
            // Sırayla sil — depolama katmanına aynı anda çok istek gitmesin.
            void list.reduce(
              (chain, item) => chain.then(() => remove(item.episodeId)),
              Promise.resolve(),
            );
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bg }}>
      <ImmersiveHeader title="İndirilenler" onBack={() => navigation.goBack()} />

      {list.length === 0 ? (
        <EmptyState
          title="İndirilen bölüm yok"
          description="Bir bölümün ayrıntı panelinden İndir'e dokunarak çevrimdışı dinleyebilirsin."
        />
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: theme.spacing(2),
              paddingBottom: theme.spacing(1),
            }}>
            <Text variant="caption" color={theme.colors.textMuted}>
              {downloadedCount} bölüm cihazda
            </Text>
            <Pressable
              onPress={confirmRemoveAll}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Tüm indirmeleri sil">
              <Text variant="caption" color={theme.colors.danger}>
                Tümünü sil
              </Text>
            </Pressable>
          </View>

          <FlashList
            data={list}
            keyExtractor={item => item.episodeId}
            onScroll={scrimScrollHandler}
            scrollEventThrottle={16}
            contentContainerStyle={{ paddingBottom: theme.spacing(12) }}
            renderItem={({ item }) => (
              <DownloadRow
                item={item}
                showTitle={showTitleOf(item.showId)}
                busy={busyId === item.episodeId}
                onPlay={() => play(toEpisode(item))}
                onRemove={() => confirmRemove(item)}
              />
            )}
          />
        </>
      )}
    </View>
  );
};

/** Tek indirme satırı: kapak, başlık/şov, durum ve sil düğmesi. */
const DownloadRow: React.FC<{
  item: DownloadItem;
  showTitle: string;
  busy: boolean;
  onPlay: () => void;
  onRemove: () => void;
}> = ({ item, showTitle, busy, onPlay, onRemove }) => {
  const theme = useTheme();
  const ready = item.status === 'downloaded';

  const statusText =
    item.status === 'downloading'
      ? 'İndiriliyor…'
      : item.status === 'failed'
        ? 'İndirilemedi'
        : formatDuration(item.durationSec ?? 0);

  const statusColor =
    item.status === 'failed'
      ? theme.colors.danger
      : item.status === 'downloading'
        ? theme.colors.accent
        : theme.colors.textMuted;

  return (
    <Pressable
      onPress={ready ? onPlay : undefined}
      disabled={!ready || busy}
      accessibilityRole="button"
      accessibilityLabel={item.episodeTitle ?? 'Bölüm'}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
        paddingVertical: theme.spacing(1.25),
        paddingHorizontal: theme.spacing(2),
        opacity: busy ? 0.5 : 1,
      }}>
      <CoverImage uri={item.artworkUrl} size={48} radius={theme.radius.md} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="subtitle" numberOfLines={2}>
          {item.episodeTitle ?? 'Bölüm'}
        </Text>
        {!!showTitle && (
          <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
            {showTitle}
          </Text>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
          {ready && <Icon name="downloaded" size={12} color={theme.colors.accent} />}
          <Text variant="caption" color={statusColor}>
            {statusText}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onRemove}
        disabled={busy}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="İndirmeyi sil">
        <Icon name="close" size={20} color={theme.colors.textMuted} />
      </Pressable>
    </Pressable>
  );
};
