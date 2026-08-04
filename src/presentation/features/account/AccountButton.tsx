import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { isAnonymous, userDisplayName, userInitial } from '@domain/entities';
import { Avatar, Popover, headerMetrics, useAnchor } from '../../ui';
import { useCurrentUser } from '../../query';
import { AccountPanel } from './AccountPanel';
import { AuthSheet } from './AuthSheet';

/**
 * Başlıktaki avatarın çapı — Kütüphane'deki ayarlar simgesiyle AYNI kaynak.
 *
 * İki sekmede aynı hizada duran iki düğmenin farklı boyutta olması, sekme
 * değiştirirken göz için zıplama yaratıyordu.
 */
const SIZE = headerMetrics.actionSize;

/**
 * AccountButton — başlıktaki yuvarlak hesap düğmesi ve paneli.
 *
 * Hesabın TEK giriş noktasıdır: giriş, çıkış, ad ve fotoğraf buradan yönetilir.
 * Ayarlarda ikinci bir hesap bölümü tutmak, iki yüzeyin zamanla ayrışması
 * demekti.
 *
 * Düğme sunucu kapalıyken de görünür — o durumda panel misafir kimliğini
 * anlatır ve hesap eylemlerini gizler (bkz. AccountPanel).
 */
export const AccountButton: React.FC = () => {
  const { data: user } = useCurrentUser();
  const anchor = useAnchor();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);

  const show = (): void => {
    // Ölçüm açılıştan önce alınır ki kart düğmenin altında belirsin.
    anchor.measure();
    setOpen(true);
  };

  const label = isAnonymous(user)
    ? 'Hesap — misafir olarak kullanıyorsun'
    : `Hesap — ${userDisplayName(user)}`;

  return (
    <>
      <View ref={anchor.ref} collapsable={false}>
        <Pressable
          onPress={show}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={label}>
          <Avatar size={SIZE} uri={user?.avatarUrl} initial={userInitial(user)} ring />
        </Pressable>
      </View>

      <Popover visible={open} onClose={() => setOpen(false)} anchor={anchor.rect}>
        <AccountPanel
          onClose={() => setOpen(false)}
          onRequestAuth={() => setAuthOpen(true)}
        />
      </Popover>

      {/* Giriş paneli popover'ın DIŞINDA durur: iOS'ta iç içe modal açmak
          güvenilir değildir, bu yüzden popover kapanır ve panel onun yerine
          açılır. */}
      <AuthSheet visible={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
};
