import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Icon } from './Icon';
import { Popover, useAnchor } from './Popover';
import { Text } from './Text';

/** Düğmenin kare ölçüsü — arama kutusuyla aynı yükseklikte durur. */
const BUTTON_SIZE = 42;
/** "Filtre açık" göstergesinin çapı. */
const DOT_SIZE = 9;

/**
 * FilterMenu — liste filtrelerini taşıyan panel ve onu açan düğme.
 *
 * Filtreler listenin üstünde satır satır durduğunda hem yer kaplıyor hem de
 * her ekranda başka türlü diziliyordu. Panel, onları TEK bir yüzeyde toplar ve
 * ekranlar arasında aynı görünmesini sağlar.
 *
 * Panel tetikleyicinin altında açılır (`Popover`): dışarı dokunmak kapatır,
 * içerideki seçeneklere dokunmak kapatMAZ — kullanıcı birden çok filtreyi
 * arka arkaya değiştirebilir.
 *
 * Bir filtre varsayılandan farklıysa düğmede bir NOKTA belirir; panel kapalıyken
 * de listenin süzülmüş olduğu anlaşılır.
 */
export const FilterMenu: React.FC<{
  /** Varsayılandan farklı en az bir filtre var mı. */
  active?: boolean;
  children: React.ReactNode;
}> = ({ active, children }) => {
  const theme = useTheme();
  const anchor = useAnchor();
  const [open, setOpen] = useState(false);

  return (
    <>
      <View ref={anchor.ref} collapsable={false}>
        <Pressable
          onPress={() => {
            // Ölçüm açılıştan önce alınır ki panel düğmenin altında belirsin.
            anchor.measure();
            setOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel="Filtreler"
          accessibilityState={{ expanded: open }}
          style={{
            width: BUTTON_SIZE,
            height: BUTTON_SIZE,
            borderRadius: theme.radius.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
            borderWidth: 1,
            borderColor: active ? theme.colors.accent : 'transparent',
          }}>
          <Icon
            name="filter"
            size={20}
            color={active ? theme.colors.accent : theme.colors.textMuted}
          />
          {active && (
            <View
              style={{
                position: 'absolute',
                top: 6,
                right: 6,
                width: DOT_SIZE,
                height: DOT_SIZE,
                borderRadius: DOT_SIZE / 2,
                backgroundColor: theme.colors.accent,
                borderWidth: 1.5,
                borderColor: theme.colors.surface,
              }}
            />
          )}
        </Pressable>
      </View>

      <Popover visible={open} onClose={() => setOpen(false)} anchor={anchor.rect} width={240}>
        <View style={{ paddingVertical: theme.spacing(0.5) }}>{children}</View>
      </Popover>
    </>
  );
};

/** Panel içindeki başlık — seçenek gruplarını ayırır. */
export const FilterSection: React.FC<{ title: string }> = ({ title }) => {
  const theme = useTheme();
  return (
    <Text
      variant="label"
      color={theme.colors.textDim}
      uppercase
      style={{
        paddingHorizontal: theme.spacing(2),
        paddingTop: theme.spacing(1.25),
        paddingBottom: theme.spacing(0.5),
      }}>
      {title}
    </Text>
  );
};

/**
 * Panel içindeki tek seçenek.
 *
 * Seçili durum onay işaretiyle gösterilir; hem açma/kapama (anahtar) hem de
 * seçenek listesi (sıralama) aynı bileşenle yazılır — iki ayrı görünüm,
 * kullanıcıya iki ayrı dil öğretmek olurdu.
 */
export const FilterOption: React.FC<{
  label: string;
  selected: boolean;
  onPress: () => void;
}> = ({ label, selected, onPress }) => {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: theme.spacing(1.5),
        paddingVertical: theme.spacing(1.25),
        paddingHorizontal: theme.spacing(2),
      }}>
      <Text variant="body" color={selected ? theme.colors.accent : theme.colors.text}>
        {label}
      </Text>
      {selected && <Icon name="checkmark" size={18} color={theme.colors.accent} />}
    </Pressable>
  );
};

/** Panel içindeki ince ayraç. */
export const FilterDivider: React.FC = () => {
  const theme = useTheme();
  return (
    <View
      style={{
        height: 1,
        marginVertical: theme.spacing(0.5),
        backgroundColor: theme.colors.divider,
      }}
    />
  );
};
