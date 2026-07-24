import React, { useEffect, useRef } from 'react';
import { Pressable } from 'react-native';
import { useTheme } from '../../../theme';
import { Icon } from '../../../ui';

/** Basılı tutunca sarma başlamadan önceki bekleme (ms). */
const HOLD_DELAY = 350;
/** Sarma tık aralığı (ms) ve adım (sn) → ~2x hız. */
const SEEK_TICK_MS = 250;
const SEEK_STEP_SEC = 0.5;

/**
 * SkipButton — Player ileri/geri tuşu.
 *  • Tek dokunuş → onTap (sonraki bölüm / başa sar / önceki bölüm mantığı çağırana ait).
 *  • Basılı tut → 2x ileri/geri sarma (konumu sürekli günceller).
 */
export const SkipButton: React.FC<{
  direction: 'forward' | 'back';
  onTap: () => void;
  onSeekTo: (sec: number) => void;
  getPosition: () => number;
  getDuration: () => number;
  size?: number;
}> = ({ direction, onTap, onSeekTo, getPosition, getDuration, size = 30 }) => {
  const theme = useTheme();
  const holdTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const interval = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const holding = useRef(false);
  const base = useRef(0);

  const stopSeek = () => {
    if (interval.current) {
      clearInterval(interval.current);
      interval.current = undefined;
    }
  };

  const startSeek = () => {
    holding.current = true;
    base.current = getPosition();
    interval.current = setInterval(() => {
      const dur = getDuration();
      const step = direction === 'forward' ? SEEK_STEP_SEC : -SEEK_STEP_SEC;
      const max = dur > 0 ? dur : base.current;
      base.current = Math.max(0, Math.min(max, base.current + step));
      onSeekTo(base.current);
    }, SEEK_TICK_MS);
  };

  const onPressIn = () => {
    holdTimeout.current = setTimeout(startSeek, HOLD_DELAY);
  };

  const onPressOut = () => {
    if (holdTimeout.current) {
      clearTimeout(holdTimeout.current);
    }
    if (holding.current) {
      holding.current = false;
      stopSeek();
    } else {
      onTap();
    }
  };

  useEffect(
    () => () => {
      stopSeek();
      if (holdTimeout.current) {
        clearTimeout(holdTimeout.current);
      }
    },
    [],
  );

  return (
    <Pressable
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={direction === 'forward' ? 'Sonraki / ileri sar' : 'Başa / önceki / geri sar'}>
      <Icon name={direction === 'forward' ? 'forward' : 'backward'} size={size} color={theme.colors.text} />
    </Pressable>
  );
};
