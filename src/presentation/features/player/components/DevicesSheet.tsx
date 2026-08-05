import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { PlaybackDevice } from '@domain/entities';
import { useTheme } from '../../../theme';
import { BottomSheet, Icon, NowPlayingBars, Text } from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlaybackDevices, useTakeOverPlayback, useThisDeviceId } from '../useDeviceSession';

/**
 * DevicesSheet — hesabın cihazları ve oynatmanın hangisinde olduğu.
 *
 * Bir hesapta aynı anda TEK cihaz çalar. Panel bunu gösterir ve gerekirse
 * oynatmayı buraya almayı sağlar. Başka bir cihaza oynatma GÖNDERİLEMEZ:
 * bunun için cihazlar arası gerçek zamanlı bir kanal gerekirdi; panel
 * yapamadığı bir şeyi vaat etmez.
 */
export const DevicesSheet: React.FC<{ visible: boolean; onClose: () => void }> = ({
  visible,
  onClose,
}) => {
  const theme = useTheme();
  const { deviceSession, routePicker } = useDependencies();
  const devices = usePlaybackDevices();
  const thisDeviceId = useThisDeviceId();
  const takeOver = useTakeOverPlayback();

  const list = devices.data ?? [];
  const activeElsewhere = list.some(d => d.active && d.id !== thisDeviceId);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(1) }}>
        <Text variant="heading">Cihazlar</Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
          Hesabında aynı anda tek cihazda dinleyebilirsin.
        </Text>

        {!deviceSession.available ? (
          <Text
            variant="caption"
            color={theme.colors.textMuted}
            style={{ marginTop: theme.spacing(2) }}>
            Sunucu yapılandırılmadığı için cihaz yönetimi kapalı.
          </Text>
        ) : devices.isLoading ? (
          <ActivityIndicator style={{ marginTop: theme.spacing(2) }} color={theme.colors.accent} />
        ) : list.length === 0 ? (
          <Text
            variant="caption"
            color={theme.colors.textMuted}
            style={{ marginTop: theme.spacing(2) }}>
            Henüz kayıtlı cihaz yok. Bir bölüm çalmaya başladığında bu cihaz listeye eklenir.
          </Text>
        ) : (
          <View style={{ marginTop: theme.spacing(1.5) }}>
            {list.map(device => (
              <DeviceRow
                key={device.id}
                device={device}
                isThisDevice={device.id === thisDeviceId}
              />
            ))}
          </View>
        )}

        {/* Ses ÇIKIŞI (AirPlay/Bluetooth) ayrı bir kavramdır: hesabın hangi
            cihazda çaldığı değil, bu cihazın sesi nereye verdiğidir. İkisi de
            "cihaz" başlığı altında beklendiği için aynı panelde, ayrı bölümde
            durur. Platform desteklemiyorsa satır hiç görünmez. */}
        {routePicker.available && (
          <Pressable
            onPress={() => routePicker.present()}
            accessibilityRole="button"
            accessibilityLabel="Ses çıkışını seç"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: theme.spacing(1.5),
              marginTop: theme.spacing(1.5),
              paddingTop: theme.spacing(1.5),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.border,
            }}>
            <Icon name="audio-output" size={20} color={theme.colors.textMuted} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="bodyStrong">Ses çıkışı</Text>
              <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
                AirPlay ya da Bluetooth hoparlör seç
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
          </Pressable>
        )}

        {activeElsewhere && (
          <Pressable
            onPress={() => {
              void takeOver();
              onClose();
            }}
            accessibilityRole="button"
            accessibilityLabel="Oynatmayı buraya al"
            style={{
              marginTop: theme.spacing(2),
              paddingVertical: theme.spacing(1.5),
              borderRadius: theme.radius.pill,
              alignItems: 'center',
              backgroundColor: theme.colors.accent,
            }}>
            <Text variant="bodyStrong" color={theme.colors.onAccent}>
              Oynatmayı buraya al
            </Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  );
};

/** Tek cihaz satırı; çalan cihaz ses çubuklarıyla işaretlenir. */
const DeviceRow: React.FC<{ device: PlaybackDevice; isThisDevice: boolean }> = ({
  device,
  isThisDevice,
}) => {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.5),
        paddingVertical: theme.spacing(1.25),
      }}>
      <Icon
        name="cast"
        size={20}
        color={device.active ? theme.colors.accent : theme.colors.textMuted}
      />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="bodyStrong" color={device.active ? theme.colors.accent : theme.colors.text}>
          {device.name}
          {isThisDevice ? ' · bu cihaz' : ''}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 2 }}>
          {device.active ? 'Şu an çalıyor' : 'Boşta'}
        </Text>
      </View>
      {device.active && <NowPlayingBars playing />}
    </View>
  );
};
