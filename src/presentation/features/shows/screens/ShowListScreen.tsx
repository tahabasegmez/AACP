import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native';
import { Show } from '@domain/entities';
import { useTheme } from '../../../theme';
import { useShowsQuery } from '../../../query';
import type { RootStackParamList } from '../../../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'ShowList'>;

/**
 * ShowListScreen — AA şovlarının listesi (ana ekran).
 *
 * Veriyi yalnızca useShowsQuery'den alır; RSS/cache ayrıntısını bilmez.
 * Bu iskelet minimal tutuldu; tasarım/bileşenler sonra zenginleştirilecek.
 */
export const ShowListScreen: React.FC<Props> = ({ navigation }) => {
  const theme = useTheme();
  const { data: shows, isLoading, isError, refetch } = useShowsQuery();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: theme.colors.text }}>Şovlar yüklenemedi.</Text>
        <Pressable onPress={() => refetch()} style={{ marginTop: theme.spacing(2) }}>
          <Text style={{ color: theme.colors.primary }}>Tekrar dene</Text>
        </Pressable>
      </View>
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
