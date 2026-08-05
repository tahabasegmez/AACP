import { PlaybackDevice, activeDevice, playbackTakenOver } from '../PlaybackDevice';

const device = (id: string, active: boolean): PlaybackDevice => ({
  id,
  name: id,
  platform: 'ios',
  active,
  lastSeenAt: '2026-01-01T00:00:00.000Z',
});

describe('activeDevice', () => {
  it('çalan cihazı bulur', () => {
    expect(activeDevice([device('a', false), device('b', true)])?.id).toBe('b');
  });

  it('kimse çalmıyorsa undefined döner', () => {
    expect(activeDevice([device('a', false)])).toBeUndefined();
  });
});

describe('playbackTakenOver', () => {
  it('başka cihaz çalıyorsa devralınmış sayılır', () => {
    expect(playbackTakenOver([device('a', false), device('b', true)], 'a')).toBe(true);
  });

  it('çalan cihaz bizsek devralma yoktur', () => {
    expect(playbackTakenOver([device('a', true)], 'a')).toBe(false);
  });

  it('hiç aktif cihaz yoksa kayıp sayılmaz', () => {
    // Boş oturum bir devralma değildir; burada duraklatmak yanlış olurdu.
    expect(playbackTakenOver([device('a', false)], 'a')).toBe(false);
    expect(playbackTakenOver([], 'a')).toBe(false);
  });
});
