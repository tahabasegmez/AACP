import { formatDuration, parseItunesDuration } from '../time';

describe('formatDuration', () => {
  it('bir saatin altını MM:SS gösterir', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(9)).toBe('0:09');
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(309)).toBe('5:09');
  });

  it('bir saatin üstünü H:MM:SS gösterir', () => {
    expect(formatDuration(3723)).toBe('1:02:03');
  });

  it('geçersiz girdide 0:00 döner', () => {
    expect(formatDuration(-5)).toBe('0:00');
    expect(formatDuration(NaN)).toBe('0:00');
  });
});

describe('parseItunesDuration', () => {
  it('saniye string/number', () => {
    expect(parseItunesDuration('90')).toBe(90);
    expect(parseItunesDuration(1244)).toBe(1244);
  });

  it('MM:SS ve HH:MM:SS', () => {
    expect(parseItunesDuration('20:30')).toBe(1230);
    expect(parseItunesDuration('1:02:03')).toBe(3723);
  });

  it('tanımsız/geçersiz girdide 0', () => {
    expect(parseItunesDuration(undefined)).toBe(0);
    expect(parseItunesDuration('abc')).toBe(0);
  });
});
