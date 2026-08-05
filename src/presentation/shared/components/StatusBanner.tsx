import React from 'react';
import { Pressable, View } from 'react-native';
import { useTheme } from '../../theme';
import { Icon, IconName, Text } from '../../ui';

/**
 * StatusBanner — dock'un üstünde beliren ince durum şeridi.
 *
 * Çevrimdışı uyarısı ve "başka cihazda çalıyor" bilgisi AYNI şeridi kullanır:
 * ikisi de geçici, bilgilendirici ve ekranı kaydırmayan mesajlardır. Ayrı ayrı
 * yazılsalardı iki farklı yükseklik, kenar boşluğu ve tipografi ortaya çıkardı.
 *
 * Renk çağırana bırakılır; anlam farkı (uyarı / eylem gerektiren durum) renkle
 * taşınır. `action` verildiğinde şerit dokunulabilir olur.
 */
export const StatusBanner: React.FC<{
  icon: IconName;
  label: string;
  /** Şerit zemini. */
  background: string;
  /** Zemin üstünde okunaklı metin/simge rengi. */
  foreground: string;
  /** Sağda gösterilen eylem etiketi (ör. "Buraya al"). */
  actionLabel?: string;
  onPress?: () => void;
}> = ({ icon, label, background, foreground, actionLabel, onPress }) => {
  const theme = useTheme();

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.spacing(0.75),
        marginHorizontal: theme.spacing(1),
        marginBottom: theme.spacing(0.75),
        paddingVertical: 4,
        paddingHorizontal: theme.spacing(1),
        borderRadius: theme.radius.sm,
        backgroundColor: background,
      }}>
      <Icon name={icon} size={12} color={foreground} />
      <Text variant="caption" color={foreground} numberOfLines={1} style={{ flexShrink: 1 }}>
        {label}
      </Text>
      {!!actionLabel && (
        <Text variant="caption" color={foreground} style={{ fontWeight: '700' }}>
          {actionLabel}
        </Text>
      )}
    </View>
  );

  if (!onPress) {
    // Dokunulamaz şerit dokunuşları GEÇİRİR; altındaki mini player'ı kapatmaz.
    return <View pointerEvents="none">{content}</View>;
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      {content}
    </Pressable>
  );
};
