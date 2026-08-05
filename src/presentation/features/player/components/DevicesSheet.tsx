import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { PlaybackDevice, isAnonymous } from '@domain/entities';
import { useTheme } from '../../../theme';
import { BottomSheet, Icon, NowPlayingBars, Text } from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlayerStore } from '../../../stores';
import { useCurrentUser } from '../../../query';
import {
  usePlaybackDevices,
  useTakeOverPlayback,
  useThisDeviceId,
  useTransferPlayback,
} from '../useDeviceSession';

/**
 * DevicesSheet — hesabın cihazları ve oynatmanın hangisinde olduğu.
 *
 * Bir hesapta aynı anda TEK cihaz çalar. Panel bunu gösterir ve oynatmayı iki
 * yönde de taşır: başka cihazdaysa buraya alır, buradaysa seçilen cihaza
 * gönderir.
 *
 * Aktarım ANINDA DEĞİLDİR: hedef cihaz komutu kendi turunda (birkaç saniye)
 * alır. Cihazlar arasında kalıcı bir bağlantı yok; komut sunucuda bekler.
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
  const { data: user } = useCurrentUser();
  const guest = isAnonymous(user);
  const episode = usePlayerStore(s => s.currentEpisode);
  const { transfer, pendingDeviceId } = useTransferPlayback();

  const list = devices.data ?? [];
  const activeElsewhere = list.some(d => d.active && d.id !== thisDeviceId);

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={{ paddingHorizontal: theme.spacing(2.5), paddingBottom: theme.spacing(1) }}>
        <Text variant="heading">Cihazlar</Text>
        <Text variant="caption" color={theme.colors.textMuted} style={{ marginTop: 4 }}>
          Aynı anda tek cihazda dinleyebilirsin. Oynatmayı göndermek için bir cihaz seç.
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
        ) : guest ? (
          // Misafir kullanıcı her cihazda AYRI bir kimliktir; cihazlar ancak
          // aynı hesaba girildiğinde birbirini görebilir. "Kayıtlı cihaz yok"
          // demek, kullanıcıyı bozuk bir özellik olduğuna inandırırdı.
          <Text
            variant="caption"
            color={theme.colors.textMuted}
            style={{ marginTop: theme.spacing(2) }}>
            Cihazlarını birlikte görmek için hesabına giriş yap. Misafir olarak her cihaz ayrı
            sayılır.
          </Text>
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
                // Aktarım ancak çalan bir bölüm varken anlamlıdır ve yalnızca
                // BAŞKA bir cihaza yapılır.
                canTransfer={!!episode && device.id !== thisDeviceId}
                busy={pendingDeviceId === device.id}
                onTransfer={() => {
                  void transfer(device.id, device.name).then(sent => {
                    if (sent) {
                      onClose();
                    }
                  });
                }}
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

interface DeviceRowProps {
  readonly device: PlaybackDevice;
  readonly isThisDevice: boolean;
  /** Oynatma bu cihaza gönderilebilir mi? */
  readonly canTransfer: boolean;
  readonly busy: boolean;
  readonly onTransfer: () => void;
}

/**
 * Tek cihaz satırı; çalan cihaz ses çubuklarıyla işaretlenir.
 *
 * Satıra dokunmak oynatmayı O CİHAZA gönderir. Dokunulabilir olmadığı
 * durumlarda (bu cihaz, ya da çalan bir bölüm yok) satır düz bir liste öğesi
 * gibi davranır — basılabilir görünüp hiçbir şey yapmamak, düğmeyi bozuk
 * göstermek olurdu.
 */
const DeviceRow: React.FC<DeviceRowProps> = ({
  device,
  isThisDevice,
  canTransfer,
  busy,
  onTransfer,
}) => {
  const theme = useTheme();

  const body = (
    <>
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
          {device.active ? 'Şu an çalıyor' : canTransfer ? 'Buraya gönder' : 'Boşta'}
        </Text>
      </View>
      {busy ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : device.active ? (
        <NowPlayingBars playing />
      ) : canTransfer ? (
        <Icon name="chevron-right" size={18} color={theme.colors.textMuted} />
      ) : null}
    </>
  );

  const style = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: theme.spacing(1.5),
    paddingVertical: theme.spacing(1.25),
  };

  if (!canTransfer) {
    return <View style={style}>{body}</View>;
  }

  return (
    <Pressable
      onPress={onTransfer}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={`Oynatmayı ${device.name} cihazına gönder`}
      style={({ pressed }) => [style, { opacity: pressed || busy ? 0.6 : 1 }]}>
      {body}
    </Pressable>
  );
};
