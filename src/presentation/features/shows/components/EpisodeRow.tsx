import React from 'react';
import { Pressable, View } from 'react-native';
import { Episode } from '@domain/entities';
import { formatDuration } from '@core/utils';
import { useTheme } from '../../../theme';
import { Icon, NowPlayingBars, Text } from '../../../ui';
import { useEpisodeStatus } from '../../player/useEpisodeStatus';
import { useNowPlaying } from '../../player/useNowPlaying';

const formatDate = (iso: string): string => {
  if (!iso) {
    return '';
  }
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
};

/**
 * EpisodeRow — şov detayındaki bölüm satırı: başlık, tarih/süre, kaldığın-yer
 * çubuğu (varsa) ve çal ikonu. Tamamlanan bölüm soluk gösterilir.
 */
export const EpisodeRow: React.FC<{
  episode: Episode;
  /**
   * Meta satırında tarihin yerine gösterilecek metin (ör. listelerde şovun adı).
   * Verildiğinde ilerleme çubuğu yerine bu metin öne çıkar.
   */
  subtitle?: string;
  /** Satıra dokunma → ayrıntı paneli. */
  onPress: () => void;
  /** Çal ikonu → doğrudan oynat. */
  onPlay: () => void;
  /** Uzun basma → bağlama özel eylem (ör. listeden çıkar). */
  onLongPress?: () => void;
}> = ({ episode, subtitle, onPress, onPlay, onLongPress }) => {
  const theme = useTheme();
  const { isCurrent, isPlaying } = useNowPlaying(episode.id);
  // Dinlenme durumu satırın KENDİSİ tarafından sorulur; her ekranda prop olarak
  // taşımak, yeni bir liste eklendiğinde işareti unutmaya açıktı.
  const { completed, fraction, started } = useEpisodeStatus(episode.id);
  // Çalan bölüm tamamlanmış olsa da soluklaştırılmaz: dikkat çekmeli.
  const dim = completed && !isCurrent ? 0.5 : 1;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${episode.title} — ayrıntılar`}
      style={{
        flexDirection: 'row',
        gap: theme.spacing(1.5),
        paddingVertical: theme.spacing(1.5),
        paddingHorizontal: theme.spacing(2),
        borderTopWidth: 1,
        borderTopColor: theme.colors.divider,
        backgroundColor: theme.colors.bg,
        opacity: dim,
      }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          variant="bodyStrong"
          numberOfLines={2}
          color={isCurrent ? theme.colors.accent : undefined}>
          {episode.title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: theme.spacing(1),
            marginTop: theme.spacing(0.75),
          }}>
          <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
            {subtitle || formatDate(episode.publishedAt)}
          </Text>
          <View style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: theme.colors.textMuted }} />
          {/* "Dinlendi" işareti her listede önceliklidir; kaldığın yer çubuğu
              yalnızca yarım kalan bölümlerde anlamlıdır. */}
          {completed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <Icon name="checkmark" size={13} color={theme.colors.accent} />
              <Text variant="caption" color={theme.colors.accent}>
                dinlendi
              </Text>
            </View>
          ) : subtitle ? (
            <Text variant="caption" color={theme.colors.textMuted}>
              {formatDuration(episode.durationSec)}
            </Text>
          ) : started && fraction > 0 ? (
            <>
              <View
                style={{
                  width: 80,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: theme.colors.border,
                  overflow: 'hidden',
                }}>
                <View
                  style={{
                    height: '100%',
                    width: `${fraction * 100}%`,
                    backgroundColor: theme.colors.accent,
                  }}
                />
              </View>
              <Text variant="caption" color={theme.colors.textMuted}>
                kaldığın yer
              </Text>
            </>
          ) : (
            <Text variant="caption" color={theme.colors.textMuted}>
              {formatDuration(episode.durationSec)}
            </Text>
          )}
        </View>
      </View>
      {/* Çalan bölümde çal ikonu yerine "çalıyor" göstergesi durur; dokunmak
          yine oynatıcıyı açar (baştan başlatmaz). */}
      <Pressable
        onPress={onPlay}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel={isCurrent ? 'Oynatıcıyı aç' : 'Çal'}
        style={{ justifyContent: 'center' }}>
        {isCurrent ? (
          <NowPlayingBars playing={isPlaying} />
        ) : (
          <Icon name="play" size={24} color={theme.colors.text} />
        )}
      </Pressable>
    </Pressable>
  );
};
