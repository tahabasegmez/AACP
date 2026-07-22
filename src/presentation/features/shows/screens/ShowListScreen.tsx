import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { FlatList, Pressable, Text } from 'react-native';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { useShowsQuery } from '../../../query';
import { EmptyState, ErrorView, LoadingView } from '../../../shared/components';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowList'>;

/**
 * ShowListScreen — AA şovlarının listesi (ana ekran).
 *
 * Veriyi yalnızca useShowsQuery'den alır; RSS/cache ayrıntısını bilmez.
 * Yüklenme/hata/boş durumları ortak bileşenlerle tutarlı gösterilir.
 */
export const ShowListScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const { data: shows, isLoading, isError, error, refetch } = useShowsQuery();

  if (isLoading) {
    return <LoadingView />;
  }
  if (isError) {
    return <ErrorView error={error} onRetry={refetch} />;
  }
  if (!shows || shows.length === 0) {
    return (
      <EmptyState
        title="Şov bulunamadı"
        description="Şu anda gösterilecek podcast bulunmuyor."
      />
    );
  }

  const renderItem = ({ item }: { item: Show }) => (
    <Pressable
      onPress={() =>
        navigation.navigate('ShowDetail', {
          showId: item.id,
          feedUrl: item.feedUrl,
          title: item.title,
        })
      }
      style={{ padding: theme.spacing(2) }}>
      <Text style={{ color: theme.colors.text, fontSize: 16 }}>{item.title}</Text>
      {!!item.author && (
        <Text style={{ color: theme.colors.textMuted }}>{item.author}</Text>
      )}
    </Pressable>
  );

  return (
    <FlatList
      style={{ backgroundColor: theme.colors.background }}
      data={shows}
      keyExtractor={item => item.id}
      renderItem={renderItem}
    />
  );
};
