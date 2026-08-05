import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Linking,
  PanResponder,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { AdPlaybackState } from '@domain/entities';
import { formatDuration, stripHtml } from '@core/utils';
import { useTheme } from '../../../theme';
import {
  CoverGradient,
  CoverImage,
  Icon,
  IconName,
  Seekbar,
  Text,
  TextSheet,
  useHeroCoverSize,
} from '../../../ui';
import { useDependencies } from '../../../di';
import { usePlayerStore, useSleepTimerStore } from '../../../stores';
import {
  useEpisodeNotes,
  useSavedEpisodes,
  useShowsQuery,
  useToggleSaved,
} from '../../../query';
import { useAppNavigation } from '../../../navigation/useAppNavigation';
import { usePlaybackController } from '../usePlaybackController';
import { useDownloads, useDownloadStatus } from '../../downloads/useDownloads';
import { SkipButton } from '../components/SkipButton';
import { PlayerMenuSheet } from '../components/PlayerMenuSheet';
import { QueueSheet } from '../components/QueueSheet';
import { DevicesSheet } from '../components/DevicesSheet';
import { SleepTimerSheet } from '../components/SleepTimerSheet';

const SPEEDS = [1, 1.25, 1.5, 1.75, 2];

/**
 * PlayerScreen — tam ekran "Şimdi Çalıyor".
 * Düzen: üstte oynatıcı (kapak, seek, transport), ortada bölüm notları düğmesi,
 * altta ikincil araçlar (hız, uyku, kuyruk, indir, cihaz, paylaş).
 */
export const PlayerScreen: React.FC = () => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useAppNavigation();
  const { seekTo, setPlaybackRate } = useDependencies();
  const { togglePlay, next, previous } = usePlaybackController();
  const { start: startDownload } = useDownloads();

  const playback = usePlayerStore(s => s.playback);
  const episode = usePlayerStore(s => s.currentEpisode);
  const dlStatus = useDownloadStatus(episode?.id ?? '');

  // "Sonra dinle" — dinlerken bölümü listeye eklemenin doğal yeri burasıdır.
  const saved = useSavedEpisodes();
  const toggleSaved = useToggleSaved();
  const isSaved = (saved.data ?? []).some(e => e.id === episode?.id);

  // Notlar kaynak ne olursa olsun (ör. "Dinlemeye devam") feed'den zenginleştirilir.
  const notes = useEpisodeNotes(episode ?? undefined);
  // Kapağa dokununca açılacak şov (feed listesi).
  const shows = useShowsQuery();
  const show = (shows.data ?? []).find(s => s.id === episode?.showId);
  const openShow = () => {
    if (show) {
      navigation.replace('ShowDetail', {
        showId: show.id,
        feedUrl: show.feedUrl,
        title: show.title,
      });
    }
  };

  const sleepEndsAt = useSleepTimerStore(s => s.endsAt);
  const setSleepEndsAt = useSleepTimerStore(s => s.setEndsAt);

  const [notesOpen, setNotesOpen] = useState(false);
  const [hint, setHint] = useState('');
  // Alttan açılan paneller — hepsi ortak BottomSheet bileşenini kullanır.
  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [devicesOpen, setDevicesOpen] = useState(false);

  const isPlaying = playback.status === 'playing';
  const isBusy = playback.status === 'loading' || playback.status === 'buffering';
  /** Dolu ise şu an bir reklam çalıyor — kontroller kısıtlanır. */
  const ad = playback.ad;

  const showHint = (label: string) => {
    setHint(label);
    setTimeout(() => setHint(''), 1600);
  };

  const cycleSpeed = () => {
    const idx = SPEEDS.indexOf(playback.rate);
    setPlaybackRate.execute({ rate: SPEEDS[(idx + 1) % SPEEDS.length] });
  };

  const applySleep = (minutes: number) =>
    setSleepEndsAt(minutes > 0 ? Date.now() + minutes * 60_000 : null);

  const sleepRemainingMin =
    sleepEndsAt != null ? Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 60_000)) : null;

  const onDownload = () => {
    if (!episode) return;
    if (dlStatus === 'downloaded') {
      showHint('İndirildi');
    } else if (dlStatus !== 'downloading') {
      startDownload(episode);
    }
  };

  /**
   * Aşağı sürükleyip bırakınca player kapanır ve mini player'a döner.
   * Player bir tam-ekran modal olduğu için "küçülme" = modal'ın kapanmasıdır;
   * mini player zaten alttaki kalıcı katmanda durur.
   */
  const dragY = useRef(new Animated.Value(0)).current;
  const dismissPan = useRef(
    PanResponder.create({
      // Yalnızca belirgin AŞAĞI hareketlerde devral (yatay jestleri bozmasın).
      onMoveShouldSetPanResponder: (_e, g) => g.dy > 8 && g.dy > Math.abs(g.dx) * 1.5,
      onPanResponderMove: (_e, g) => {
        if (g.dy > 0) {
          dragY.setValue(g.dy);
        }
      },
      onPanResponderRelease: (_e, g) => {
        // Yeterince aşağı çekildiyse (ya da hızlı savrulduysa) kapat.
        if (g.dy > 120 || g.vy > 1.2) {
          navigation.goBack();
          return;
        }
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
      },
      onPanResponderTerminate: () => {
        Animated.spring(dragY, { toValue: 0, useNativeDriver: true }).start();
      },
    }),
  ).current;

  const getPosition = () => usePlayerStore.getState().playback.positionSec;
  const getDuration = () => usePlayerStore.getState().playback.durationSec;
  const doSeek = (sec: number) => seekTo.execute({ positionSec: sec });
  // Player'da kapak ekranın kahramanıdır — şov detayındakinden büyüktür.
  const coverSize = useHeroCoverSize('player');

  return (
    <Animated.View
      style={{ flex: 1, backgroundColor: theme.colors.bg, transform: [{ translateY: dragY }] }}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      {/* Arka plan: kapağın baskın renginden tema zeminine degrade */}
      <CoverGradient uri={episode?.imageUrl} style={StyleSheet.absoluteFill} />

      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12, paddingHorizontal: theme.spacing(3) }}>
        {/* Üst bar — buradan aşağı sürüklemek player'ı kapatır (mini player'a döner). */}
        <View
          {...dismissPan.panHandlers}
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityLabel="Kapat">
            <Icon name="chevron-down" size={26} color={theme.colors.text} />
          </Pressable>
          <Text variant="label" color={theme.colors.text} uppercase numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
            AA PODCAST
          </Text>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityLabel="Seçenekler">
            <Icon name="ellipsis" size={22} color={theme.colors.text} />
          </Pressable>
        </View>

        {/* Kapak: üst bar ile oynatma kümesi arasında kalan alanı doldurur ve
            içinde ortalanır. Alt küme içeriği kadar yer kapladığı için kapak
            alanı kendiliğinden dengelenir. */}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            onPress={openShow}
            disabled={!show}
            accessibilityRole="button"
            accessibilityLabel={show ? `${show.title} şovunu aç` : undefined}>
            <CoverImage uri={episode?.imageUrl} size={coverSize} radius={theme.radius.lg} />
          </Pressable>
        </View>

        {/* Alt küme — sabit düzen: içeriği kadar yer kaplar, araçlar en altta. */}
        <View>
          {/* Reklam çalarken bilgilendirme bandı; bölüm bilgisi gizlenmez. */}
          {ad && <AdBanner ad={ad} />}

          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: theme.spacing(1.5) }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="heading" numberOfLines={2}>
                {episode?.title ?? 'Bölüm seçili değil'}
              </Text>
            </View>
            {episode && !ad && (
              <Pressable
                onPress={() => toggleSaved.mutate(episode)}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel={isSaved ? 'Sonra dinleden çıkar' : 'Sonra dinleye ekle'}>
                <Icon
                  name={isSaved ? 'bookmark' : 'bookmark-outline'}
                  size={26}
                  color={isSaved ? theme.colors.accent : theme.colors.textMuted}
                />
              </Pressable>
            )}
          </View>

          <View style={{ marginTop: theme.spacing(2) }}>
            <Seekbar
              positionSec={playback.positionSec}
              durationSec={playback.durationSec}
              buffering={playback.status === 'buffering'}
              bufferedSec={playback.bufferedSec}
              // İndirilmiş bölümde tamamı hazırdır — çubuk baştan sona dolu.
              fullyBuffered={dlStatus === 'downloaded'}
              // Reklam atlanamaz: sarma devre dışı (oynatıcı da ayrıca engeller).
              disabled={!!ad}
              onSeek={doSeek}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
              <Text variant="caption" color={theme.colors.textMuted}>{formatDuration(playback.positionSec)}</Text>
              <Text variant="caption" color={theme.colors.textMuted}>{formatDuration(playback.durationSec)}</Text>
            </View>
          </View>

          {/* Reklam atlanamaz: ileri/geri atlama gizlenir, yalnızca duraklat kalır. */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: theme.spacing(3.5), marginTop: theme.spacing(1) }}>
            {!ad && (
              <SkipButton direction="back" onTap={() => previous(playback.positionSec)} onSeekTo={doSeek} getPosition={getPosition} getDuration={getDuration} />
            )}
            <Pressable
              onPress={() => void togglePlay()}
              accessibilityRole="button"
              accessibilityLabel={isPlaying ? 'Duraklat' : 'Oynat'}
              style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.text, alignItems: 'center', justifyContent: 'center' }}>
              {isBusy ? (
                <ActivityIndicator color={theme.colors.bg} />
              ) : (
                // Oynat üçgeni geometrik merkezde optik olarak sola kayık durur;
                // ~3px sağa iterek yuvarlağın tam ortasında görünmesini sağlıyoruz.
                <View style={{ marginLeft: isPlaying ? 0 : 3 }}>
                  <Icon name={isPlaying ? 'pause' : 'play'} size={32} color={theme.colors.bg} />
                </View>
              )}
            </Pressable>
            {!ad && (
              <SkipButton direction="forward" onTap={next} onSeekTo={doSeek} getPosition={getPosition} getDuration={getDuration} />
            )}
          </View>

          {/* Yalnızca geçici bilgi mesajı; uyku süresi artık timer tuşunda görünür. */}
          {hint ? (
            <Text variant="caption" color={theme.colors.textMuted} style={{ textAlign: 'center', marginTop: theme.spacing(1) }}>
              {hint}
            </Text>
          ) : null}

          {/* Bölüm notları — oynatma tuşlarıyla alt araçlar arasında, önizlemeli */}
          {!!notes && (
            <Pressable onPress={() => setNotesOpen(true)} style={{ marginTop: theme.spacing(1.75) }}>
              <Text variant="caption" color={theme.colors.textMuted} numberOfLines={2}>
                {stripHtml(notes)}
              </Text>
              <Text variant="caption" color={theme.colors.text} style={{ marginTop: 2 }}>
                devamını oku…
              </Text>
            </Pressable>
          )}

          {/* Araçlar — en altta */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing(2) }}>
            <Pressable
              onPress={cycleSpeed}
              // Reklam hızlandırılarak "atlanamaz" kuralı delinmemeli.
              disabled={!!ad}
              hitSlop={8}
              accessibilityLabel={`Oynatma hızı ${playback.rate}x`}
              style={{ backgroundColor: theme.colors.accentSoft, paddingVertical: 6, paddingHorizontal: theme.spacing(1.5), borderRadius: theme.radius.pill, opacity: ad ? 0.4 : 1 }}>
              <Text variant="subtitle" color={theme.colors.accent}>{playback.rate}×</Text>
            </Pressable>
            <View style={{ flexDirection: 'row', gap: theme.spacing(1.75) }}>
              {/* Uyku zamanlayıcı: kuruluyken simge yerine kalan dakikayı gösterir. */}
              {sleepRemainingMin != null && sleepRemainingMin > 0 ? (
                <Pressable
                  onPress={() => setSleepOpen(true)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Uyku zamanlayıcı, ${sleepRemainingMin} dakika kaldı`}
                  style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
                  <Text variant="subtitle" color={theme.colors.accent}>
                    {sleepRemainingMin}
                  </Text>
                </Pressable>
              ) : (
                <Tool icon="timer" label="Uyku" onPress={() => setSleepOpen(true)} />
              )}
              <Tool
                icon={dlStatus === 'downloaded' ? 'downloaded' : 'download'}
                label="İndir"
                active={dlStatus === 'downloaded'}
                busy={dlStatus === 'downloading'}
                onPress={onDownload}
              />
              <Tool icon="cast" label="Cihaz" onPress={() => setDevicesOpen(true)} />
              {/* Kuyruk EN SAĞDA: en sık açılan panel, başparmağa en yakın
                  köşede durur. Paylaş buradan kalktı — "…" menüsünde. */}
              <Tool icon="queue" label="Sıradakiler" onPress={() => setQueueOpen(true)} />
            </View>
          </View>
        </View>
      </View>

      <TextSheet
        visible={notesOpen}
        title="Bölüm notları"
        text={notes}
        onClose={() => setNotesOpen(false)}
      />

      {/* Alttan açılan paneller — hepsi ortak BottomSheet üzerine kuruludur. */}
      <QueueSheet visible={queueOpen} onClose={() => setQueueOpen(false)} />
      <DevicesSheet visible={devicesOpen} onClose={() => setDevicesOpen(false)} />
      <SleepTimerSheet
        visible={sleepOpen}
        activeMinutes={sleepRemainingMin ?? 0}
        onSelect={applySleep}
        onClose={() => setSleepOpen(false)}
      />
      <PlayerMenuSheet
        visible={menuOpen}
        episode={episode}
        onClose={() => setMenuOpen(false)}
        onFeedback={showHint}
      />
    </Animated.View>
  );
};

/**
 * AdBanner — reklam çalarken gösterilen bilgi bandı.
 *
 * Kullanıcıya durumu açıkça bildirir ("Reklam 1/2"), reklam verenin adını
 * gösterir ve varsa tıklanabilir bağlantıyı sunar. Bandın varlığı aynı zamanda
 * kontrollerin neden kilitli olduğunu açıklar.
 */
const AdBanner: React.FC<{ ad: AdPlaybackState }> = ({ ad }) => {
  const theme = useTheme();
  const label = ad.total > 1 ? `Reklam ${ad.index}/${ad.total}` : 'Reklam';

  const openLink = (): void => {
    if (ad.clickUrl) {
      Linking.openURL(ad.clickUrl).catch(() => {
        /* bağlantı açılamazsa sessiz geç */
      });
    }
  };

  return (
    <Pressable
      onPress={openLink}
      disabled={!ad.clickUrl}
      accessibilityRole={ad.clickUrl ? 'link' : 'text'}
      accessibilityLabel={`${label}${ad.advertiser ? ` — ${ad.advertiser}` : ''}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing(1),
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.accentSoft,
        paddingVertical: 5,
        paddingHorizontal: theme.spacing(1.25),
        borderRadius: theme.radius.pill,
        marginBottom: theme.spacing(1),
      }}>
      <Text variant="label" color={theme.colors.accent} uppercase>
        {label}
      </Text>
      {!!ad.advertiser && (
        <Text variant="caption" color={theme.colors.textMuted} numberOfLines={1}>
          {ad.advertiser}
        </Text>
      )}
      {!!ad.clickUrl && <Icon name="chevron-right" size={14} color={theme.colors.accent} />}
    </Pressable>
  );
};

const Tool: React.FC<{
  icon: IconName;
  label: string;
  onPress: () => void;
  active?: boolean;
  busy?: boolean;
}> = ({ icon, label, onPress, active, busy }) => {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}>
      {busy ? (
        <ActivityIndicator size="small" color={theme.colors.accent} />
      ) : (
        <Icon name={icon} size={22} color={active ? theme.colors.accent : theme.colors.textMuted} />
      )}
    </Pressable>
  );
};
