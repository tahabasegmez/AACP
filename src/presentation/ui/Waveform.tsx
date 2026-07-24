import React from 'react';
import { View } from 'react-native';

/** AA logosuna gönderme yapan küçük ses-dalgası işareti (dekoratif). */
export const Waveform: React.FC<{
  color?: string;
  height?: number;
  bars?: number;
  opacity?: number;
}> = ({ color = '#FFFFFF', height = 16, bars = 6, opacity = 0.9 }) => {
  const heights = React.useMemo(
    () =>
      Array.from({ length: bars }, (_, i) => {
        // Sabit ama dalga gibi görünen bir örüntü.
        const pattern = [0.45, 0.85, 1, 0.6, 0.9, 0.4, 0.75, 0.55];
        return Math.max(0.25, pattern[i % pattern.length]) * height;
      }),
    [bars, height],
  );
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 2,
        height,
        opacity,
      }}
      accessible={false}>
      {heights.map((h, i) => (
        <View
          key={i}
          style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: color }}
        />
      ))}
    </View>
  );
};
