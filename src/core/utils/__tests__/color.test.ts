import { hexToHsl, hslToHex, toBackdropColor } from '../color';

describe('hexToHsl', () => {
  it('temel renkleri çözer', () => {
    expect(hexToHsl('#000000')).toEqual({ h: 0, s: 0, l: 0 });
    const white = hexToHsl('#ffffff');
    expect(white?.l).toBe(100);
  });

  it('3 haneli kısa formu destekler', () => {
    expect(hexToHsl('#fff')?.l).toBe(100);
  });

  it('geçersiz girişte null', () => {
    expect(hexToHsl('xyz')).toBeNull();
  });
});

describe('hslToHex ↔ hexToHsl', () => {
  it('gidiş-dönüş yaklaşık korunur', () => {
    const hex = hslToHex(210, 50, 30);
    const hsl = hexToHsl(hex);
    expect(hsl).not.toBeNull();
    expect(Math.abs((hsl?.l ?? 0) - 30)).toBeLessThan(2);
  });
});

describe('toBackdropColor', () => {
  it('çok açık rengi koyulaştırır (üst limit)', () => {
    const out = toBackdropColor('#ffffff'); // beyaz → koyu
    const hsl = hexToHsl(out ?? '');
    // 8-bit yuvarlama toleransıyla üst sınıra yakın olmalı.
    expect((hsl?.l ?? 100)).toBeLessThanOrEqual(36);
  });

  it('doygunluğu taban değere yükseltir', () => {
    const out = toBackdropColor('#808080'); // gri → biraz doygun
    const hsl = hexToHsl(out ?? '');
    expect((hsl?.s ?? 0)).toBeGreaterThanOrEqual(26);
  });

  it('geçersiz girişte null', () => {
    expect(toBackdropColor('nope')).toBeNull();
  });
});
