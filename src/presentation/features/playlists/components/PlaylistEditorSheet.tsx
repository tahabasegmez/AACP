import React, { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { PLAYLIST_DESCRIPTION_MAX, PLAYLIST_NAME_MAX, Playlist } from '@domain/entities';
import { useTheme } from '../../../theme';
import { BottomSheet, CoverImage, Icon, Text } from '../../../ui';
import { useDependencies } from '../../../di';
import { useCreatePlaylist, useUpdatePlaylist } from '../../../query';

/**
 * PlaylistEditorSheet — liste oluşturma ve düzenleme paneli.
 *
 * Tek bileşen iki işi de yapar: `playlist` verilirse düzenleme, verilmezse
 * oluşturma modundadır. Aynı alanlar (kapak + ad) iki akışta da geçerli olduğu
 * için ayrı ekranlar yazmak tekrar olurdu.
 *
 * Kapak seçimi `ImagePicker` portu üzerinden yapılır; port kullanılamıyorsa
 * (native modül kurulu değilse) kapak alanı pasifleşir ve liste kapaksız
 * oluşturulur — akış bloke olmaz.
 */
export const PlaylistEditorSheet: React.FC<{
  visible: boolean;
  /** Verilirse düzenleme modu. */
  playlist?: Playlist | null;
  onClose: () => void;
  onCreated?: (playlist: Playlist) => void;
}> = ({ visible, playlist, onClose, onCreated }) => {
  const theme = useTheme();
  const { imagePicker } = useDependencies();
  const createPlaylist = useCreatePlaylist();
  const updatePlaylist = useUpdatePlaylist();

  const editing = !!playlist;
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverUri, setCoverUri] = useState<string | undefined>();

  // Panel her açılışta düzenlenen listenin güncel değerleriyle başlar.
  useEffect(() => {
    if (visible) {
      setName(playlist?.name ?? '');
      setDescription(playlist?.description ?? '');
      setCoverUri(playlist?.coverUri);
    }
  }, [visible, playlist]);

  const canSave = name.trim().length > 0;
  const busy = createPlaylist.isPending || updatePlaylist.isPending;

  const pickCover = async (): Promise<void> => {
    const picked = await imagePicker.pick();
    if (picked) {
      setCoverUri(picked.uri);
    }
  };

  const save = async (): Promise<void> => {
    if (!canSave || busy) {
      return;
    }
    if (editing && playlist) {
      // Açıklama DAİMA gönderilir: boş metin alanı temizler, gönderilmemesi
      // "dokunma" anlamına gelirdi ve kullanıcı açıklamayı silemezdi.
      await updatePlaylist.mutateAsync({
        playlistId: playlist.id,
        name,
        description,
        coverUri,
      });
    } else {
      const created = await createPlaylist.mutateAsync({ name, description, coverUri });
      onCreated?.(created);
    }
    onClose();
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(1) }}>
        <Text variant="heading">{editing ? 'Listeyi düzenle' : 'Yeni liste'}</Text>

        <View style={{ flexDirection: 'row', gap: theme.spacing(2), marginTop: theme.spacing(2) }}>
          {/* Kapak seçici */}
          <Pressable
            onPress={pickCover}
            disabled={!imagePicker.available}
            accessibilityRole="button"
            accessibilityLabel="Kapak seç"
            style={{ opacity: imagePicker.available ? 1 : 0.5 }}>
            {coverUri ? (
              <CoverImage uri={coverUri} size={96} radius={theme.radius.lg} />
            ) : (
              <View
                style={{
                  width: 96,
                  height: 96,
                  borderRadius: theme.radius.lg,
                  backgroundColor: theme.colors.surface,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                }}>
                <Icon name="library" size={24} color={theme.colors.textDim} />
                <Text variant="caption" color={theme.colors.textDim}>
                  Kapak
                </Text>
              </View>
            )}
          </Pressable>

          {/* Ad alanı */}
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text variant="label" color={theme.colors.textMuted} uppercase>
              Liste adı
            </Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Ör. Sabah dinlediklerim"
              placeholderTextColor={theme.colors.textDim}
              autoFocus
              maxLength={PLAYLIST_NAME_MAX}
              returnKeyType="done"
              onSubmitEditing={save}
              style={{
                marginTop: theme.spacing(0.5),
                paddingVertical: theme.spacing(1),
                paddingHorizontal: theme.spacing(1.25),
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text,
                fontSize: theme.typography.body.fontSize,
              }}
            />
            {!imagePicker.available && (
              <Text variant="caption" color={theme.colors.textDim} style={{ marginTop: 6 }}>
                Kapak seçimi bu sürümde kullanılamıyor.
              </Text>
            )}
          </View>
        </View>

        {/* Açıklama — kapak/ad satırının ALTINDA tam genişlik: çok satırlı
            metin dar bir sütuna sıkışmamalı. */}
        <View style={{ marginTop: theme.spacing(2) }}>
          <Text variant="label" color={theme.colors.textMuted} uppercase>
            Açıklama (isteğe bağlı)
          </Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Bu liste neyle ilgili?"
            placeholderTextColor={theme.colors.textDim}
            maxLength={PLAYLIST_DESCRIPTION_MAX}
            multiline
            style={{
              marginTop: theme.spacing(0.5),
              minHeight: 76,
              textAlignVertical: 'top',
              paddingVertical: theme.spacing(1),
              paddingHorizontal: theme.spacing(1.25),
              borderRadius: theme.radius.md,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              fontSize: theme.typography.body.fontSize,
            }}
          />
          <Text
            variant="caption"
            color={theme.colors.textDim}
            style={{ marginTop: 4, textAlign: 'right' }}>
            {description.length}/{PLAYLIST_DESCRIPTION_MAX}
          </Text>
        </View>

        <Pressable
          onPress={save}
          disabled={!canSave || busy}
          accessibilityRole="button"
          accessibilityLabel={editing ? 'Kaydet' : 'Oluştur'}
          style={{
            marginTop: theme.spacing(2.5),
            paddingVertical: theme.spacing(1.5),
            borderRadius: theme.radius.pill,
            alignItems: 'center',
            backgroundColor: canSave ? theme.colors.accent : theme.colors.surface,
            opacity: busy ? 0.6 : 1,
          }}>
          <Text variant="bodyStrong" color={canSave ? theme.colors.onAccent : theme.colors.textDim}>
            {editing ? 'Kaydet' : 'Oluştur'}
          </Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
};
