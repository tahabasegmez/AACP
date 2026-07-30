import React from 'react';
import { Pressable, View } from 'react-native';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { CoverImage, Icon, IconName, NowPlayingBars, Text } from '../../../ui';
import { useNowPlaying } from '../../player/useNowPlaying';

const DEFAULT_W = 236;

/** Meta satırındaki tarih biçimi (kısa: "12 Tem"). */
const formatDate = (iso?: string): string => {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

/**
 * EpisodeMiniCard — uygulamadaki TEK yatay bölüm kartı.
 *
 * "Dinlemeye devam", "Sonra dinle", "Yeni bölümler" ve "İndirilenler" listeleri
 * bu kartı kullanır; böylece bölüm kartı uygulamanın her yerinde aynı görünür.
 *
 * Kullanıldığı yere göre değişen EKSTRALAR opsiyoneldir ve kartın iskeletini
 * bozmaz:
 *  - `fraction` → kaldığın yer çubuğu (Dinlemeye devam)
 *  - `publishedAt` / `durationSec` → tarih·süre meta satırı (İndirilenler, Yeni)
 *  - `badge` → durum rozeti (ör. "İndirildi")
 *
 * Sunumsaldır: veri kaynağından (PlaybackProgress / Episode / DownloadItem)
 * bağımsız, yalnızca ilkel proplar alır.
 */
export const EpisodeMiniCard: React.FC<{
  artworkUrl?: string;
  title: string;
  subtitle: string;
  /** 0..1 arası ilerleme; verilirse alt çubuk gösterilir. */
  fraction?: number;
  /** Verilirse başlığın altında tarih·süre satırı çıkar. */
  publishedAt?: string;
  durationSec?: number;
  /** Küçük durum rozeti (ör. indirilmiş bölüm). */
  badge?: { icon: IconName; label: string };
  /**
   * Verilirse kart "çalıyor" durumunu KENDİSİ sorar (bkz. useNowPlaying).
   * Her çağıran yerde hesaplatmak, yeni liste eklendiğinde unutulmaya açıktı.
   */
  episodeId?: string;
  onPress: () => void;
  width?: number;
}> = ({
  artworkUrl,
  title,
  subtitle,
  fraction,
  publishedAt,
  durationSec,
  badge,
  episodeId,
  onPress,
  width = DEFAULT_W,
}) => {
  const theme = useTheme();
  const { isCurrent, isPlaying } = useNowPlaying(episodeId ?? '');
  const dateText = formatDate(publishedAt);
  const durationText = durationSec != null && durationSec > 0 ? formatDuration(durationSec) : '';
  const meta = [dateText, durationText].filter(Boolean).join(' · ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      style={{
        width,
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1.25),
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius.lg,
        padding: theme.spacing(1.25),
      }}>
      <CoverImage uri={artworkUrl} size={54} radius={theme.radius.md} />

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="subtitle"
          numberOfLines={1}
          color={isCurrent ? theme.colors.accent : undefined}>
          {title}
        </Text>
        <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
          {subtitle}
        </Text>

        {!!meta && (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5,
              marginTop: 2,
            }}>
            {badge && <Icon name={badge.icon} size={12} color={theme.colors.accent} />}
            <Text variant="caption" color={theme.colors.textDim} numberOfLines={1}>
              {meta}
            </Text>
          </View>
        )}

        {fraction != null && (
          <View
            style={{
              height: 3,
              borderRadius: 2,
              backgroundColor: theme.colors.border,
              marginTop: theme.spacing(1),
              overflow: 'hidden',
            }}>
            <View
              style={{
                height: '100%',
                width: `${Math.min(1, Math.max(0, fraction)) * 100}%`,
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>
        )}
      </View>

      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          // Çalan kartta yuvarlak dolgu kalkar: gösterge zaten dikkat çeker.
          backgroundColor: isCurrent ? 'transparent' : theme.colors.text,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        {isCurrent ? (
          <NowPlayingBars playing={isPlaying} />
        ) : (
          <Icon name="play" size={16} color={theme.colors.bg} />
        )}
      </View>
    </Pressable>
  );
};
