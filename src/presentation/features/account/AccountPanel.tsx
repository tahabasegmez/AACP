import React, { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { isAnonymous, userDisplayName, userInitial } from '@domain/entities';
import { useTheme } from '../../theme';
import { Avatar, Icon, IconName, Text } from '../../ui';
import {
  useAccountsAvailable,
  useChangeAvatar,
  useCurrentUser,
  useSignOut,
  useUpdateProfile,
} from '../../query';

/** Panelde gösterilen büyük avatarın çapı. */
const AVATAR_SIZE = 56;
/** Görünen ad için üst sınır — sunucudaki kuralla aynı. */
const MAX_NAME_LENGTH = 60;

/**
 * AccountPanel — hesap düğmesine bağlı panelin içeriği.
 *
 * Ayarlardan BURAYA taşındı: giriş, çıkış, ad ve fotoğraf tek yerde yönetilir.
 * Panel yalnızca sunumdur; kimlik akışları sorgu katmanındaki hook'larda yaşar.
 *
 * Sunucu yapılandırılmamışsa hesap eylemleri gösterilmez — çalışmayacak bir
 * düğme sunmak, kullanıcıyı boş yere denemeye çağırırdı.
 */
export const AccountPanel: React.FC<{
  onClose: () => void;
  /** Giriş/kayıt panelini açar (üst katmanda, bu panel kapandıktan sonra). */
  onRequestAuth: () => void;
}> = ({ onClose, onRequestAuth }) => {
  const theme = useTheme();
  const accountsAvailable = useAccountsAvailable();
  const { data: user } = useCurrentUser();
  const signOut = useSignOut();
  const updateProfile = useUpdateProfile();
  const avatar = useChangeAvatar();

  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState('');

  const signedIn = !!user && !isAnonymous(user);

  const changePhoto = (): void => {
    // Panel açık kalır: seçici kapandığında kullanıcı sonucu burada görür.
    void avatar.run().catch(() => Alert.alert('Fotoğraf yüklenemedi'));
  };

  const startEditingName = (): void => {
    setName(user?.displayName ?? '');
    setEditingName(true);
  };

  const saveName = (): void => {
    const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
    setEditingName(false);
    if (trimmed && trimmed !== user?.displayName) {
      updateProfile.mutate({ displayName: trimmed });
    }
  };

  const confirmSignOut = (): void => {
    onClose();
    Alert.alert(
      'Çıkış yap',
      'Bu cihazda misafir olarak devam edeceksin. Hesabındaki veriler sunucuda korunur.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        { text: 'Çıkış yap', style: 'destructive', onPress: () => signOut.mutate() },
      ],
    );
  };

  return (
    <View>
      {/* Kimlik başlığı */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing(1.5),
          padding: theme.spacing(2),
        }}>
        <Avatar size={AVATAR_SIZE} uri={user?.avatarUrl} initial={userInitial(user)} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {userDisplayName(user)}
          </Text>
          <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
            {user?.email ?? 'Misafir kullanıcı'}
          </Text>
        </View>
      </View>

      <View style={{ height: 1, backgroundColor: theme.colors.divider }} />

      {!accountsAvailable ? (
        <Text
          variant="caption"
          color={theme.colors.textMuted}
          style={{ padding: theme.spacing(2) }}>
          Sunucu yapılandırılmadığı için hesap işlemleri kapalı. Verilerin
          yalnızca bu cihazda tutuluyor.
        </Text>
      ) : signedIn ? (
        <>
          {editingName ? (
            <View style={{ padding: theme.spacing(1.5) }}>
              <TextInput
                value={name}
                onChangeText={setName}
                onSubmitEditing={saveName}
                onBlur={saveName}
                placeholder="Görünen adın"
                placeholderTextColor={theme.colors.textDim}
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                returnKeyType="done"
                style={{
                  paddingVertical: theme.spacing(1),
                  paddingHorizontal: theme.spacing(1.25),
                  borderRadius: theme.radius.md,
                  backgroundColor: theme.colors.elevated,
                  color: theme.colors.text,
                  fontSize: theme.typography.body.fontSize,
                }}
              />
            </View>
          ) : (
            <PanelRow icon="pencil" label="Adı düzenle" onPress={startEditingName} />
          )}

          <PanelRow
            icon="camera"
            label={avatar.busy ? 'Yükleniyor…' : 'Fotoğrafı değiştir'}
            // Seçici kurulu değilse satır pasifleşir; gizlemek yerine
            // pasifleştirmek nedenin anlaşılmasını sağlar.
            disabled={!avatar.available || avatar.busy}
            onPress={changePhoto}
          />
          <PanelRow
            icon="sign-out"
            label="Çıkış yap"
            color={theme.colors.danger}
            onPress={confirmSignOut}
          />
        </>
      ) : (
        <PanelRow
          icon="sign-in"
          label="Giriş yap veya hesap oluştur"
          color={theme.colors.accent}
          onPress={() => {
            onClose();
            onRequestAuth();
          }}
        />
      )}
    </View>
  );
};

/** Paneldeki tek eylem satırı. */
const PanelRow: React.FC<{
  icon: IconName;
  label: string;
  onPress: () => void;
  color?: string;
  disabled?: boolean;
}> = ({ icon, label, onPress, color, disabled }) => {
  const theme = useTheme();
  const tint = color ?? theme.colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.5),
        paddingVertical: theme.spacing(1.5),
        paddingHorizontal: theme.spacing(2),
        opacity: disabled ? 0.45 : 1,
      }}>
      <Icon name={icon} size={20} color={tint} />
      <Text variant="body" color={tint}>
        {label}
      </Text>
    </Pressable>
  );
};
