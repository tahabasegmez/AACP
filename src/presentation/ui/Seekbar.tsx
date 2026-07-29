import React, { useRef, useState } from 'react';
import {
  Animated,
  GestureResponderEvent,
  LayoutChangeEvent,
  PanResponder,
  View,
} from 'react-native';
import { useTheme } from '../theme';

/**
 * Seekbar — dokunma/sürükleme ile konum seçilen ilerleme çubuğu (native slider
 * bağımlılığı olmadan, PanResponder ile). Sürüklerken oynatma konumunu takip
 * etmez; bırakınca onSeek çağrılır. `buffering` true iken hafif bir nabız gösterir.
 *
 * `disabled` verildiğinde (ör. atlanamaz reklam çalarken) dokunma yok sayılır;
 * çubuk ilerlemeyi göstermeye devam eder ama konum değiştirilemez.
 */
export const Seekbar: React.FC<{
  positionSec: number;
  durationSec: number;
  buffering?: boolean;
  disabled?: boolean;
  /** Önden yüklenmiş konum (saniye) — çalınan noktadan sonrası açık tonla çizilir. */
  bufferedSec?: number;
  /** Bölüm tamamen hazırsa (indirilmiş) çubuk baştan sona dolu görünür. */
  fullyBuffered?: boolean;
  onSeek: (sec: number) => void;
}> = ({
  positionSec,
  durationSec,
  buffering,
  disabled,
  bufferedSec = 0,
  fullyBuffered,
  onSeek,
}) => {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [scrubbing, setScrubbing] = useState(false);
  const [scrubSec, setScrubSec] = useState(0);
  const widthRef = useRef(0);
  const durationRef = useRef(0);
  durationRef.current = durationSec;
  // PanResponder bir kez kurulduğu için güncel `disabled` değerini ref'ten okur.
  const disabledRef = useRef(false);
  disabledRef.current = !!disabled;

  const pulse = useRef(new Animated.Value(1)).current;
  React.useEffect(() => {
    if (!buffering) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [buffering, pulse]);

  const secFromX = (x: number): number => {
    if (widthRef.current <= 0 || durationRef.current <= 0) {
      return 0;
    }
    const ratio = Math.max(0, Math.min(1, x / widthRef.current));
    return ratio * durationRef.current;
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder: () => !disabledRef.current,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        setScrubbing(true);
        setScrubSec(secFromX(e.nativeEvent.locationX));
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        setScrubSec(secFromX(e.nativeEvent.locationX));
      },
      onPanResponderRelease: (e: GestureResponderEvent) => {
        const sec = secFromX(e.nativeEvent.locationX);
        setScrubbing(false);
        onSeek(sec);
      },
      onPanResponderTerminate: () => setScrubbing(false),
    }),
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    widthRef.current = w;
    setWidth(w);
  };

  const current = scrubbing ? scrubSec : positionSec;
  const fraction = durationSec > 0 ? Math.max(0, Math.min(1, current / durationSec)) : 0;
  const knobX = fraction * width;

  // Önden yüklenmiş kısım — yalnızca geçerli konumdan SONRASI çizilir.
  // `fullyBuffered` (indirilmiş bölüm) durumunda çubuk baştan sona doludur.
  const bufferedFraction = fullyBuffered
    ? 1
    : durationSec > 0
      ? Math.max(0, Math.min(1, bufferedSec / durationSec))
      : 0;
  const bufferedWidth = Math.max(0, bufferedFraction * width - knobX);

  return (
    <View
      onLayout={onLayout}
      hitSlop={{ top: 14, bottom: 14, left: 0, right: 0 }}
      accessibilityRole="adjustable"
      {...pan.panHandlers}
      style={{ height: 22, justifyContent: 'center' }}>
      <Animated.View
        style={{
          height: 4,
          borderRadius: 3,
          backgroundColor: theme.colors.border,
          overflow: 'hidden',
          opacity: buffering ? pulse : 1,
        }}>
        {/* Önden yüklenmiş kısım — çalınan konumdan sonrası, daha açık ton. */}
        {bufferedWidth > 0 && (
          <View
            style={{
              position: 'absolute',
              left: knobX,
              top: 0,
              bottom: 0,
              width: bufferedWidth,
              backgroundColor: theme.colors.accentTrack,
            }}
          />
        )}
        {/* Çalınmış kısım. */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: knobX,
            backgroundColor: theme.colors.accent,
          }}
        />
      </Animated.View>
      <View
        style={{
          position: 'absolute',
          left: Math.max(0, Math.min(width - 12, knobX - 6)),
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: theme.colors.text,
          transform: [{ scale: scrubbing ? 1.4 : 1 }],
        }}
      />
    </View>
  );
};
