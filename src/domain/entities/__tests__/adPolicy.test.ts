import {
  AdPolicyConfig,
  DEFAULT_AD_POLICY,
  INITIAL_AD_POLICY_STATE,
  onAdShown,
  onEpisodeCompleted,
  shouldRequestAd,
} from '../adPolicy';

const config = (overrides?: Partial<AdPolicyConfig>): AdPolicyConfig => ({
  ...DEFAULT_AD_POLICY,
  enabled: true,
  minIntervalMs: 0,
  ...overrides,
});

/** Bir bölüm tamamlanmış sayılan başlangıç durumu. */
const afterOneEpisode = onEpisodeCompleted(INITIAL_AD_POLICY_STATE);

const input = (overrides?: Partial<Parameters<typeof shouldRequestAd>[2]>) => ({
  placement: 'postroll' as const,
  episodeDurationSec: 600,
  nowMs: 1_000_000,
  ...overrides,
});

describe('shouldRequestAd', () => {
  it('varsayılan yapılandırmada reklam KAPALIDIR', () => {
    expect(shouldRequestAd(DEFAULT_AD_POLICY, afterOneEpisode, input())).toBe(false);
  });

  it('açıkken ve bir bölüm bittiğinde reklam ister', () => {
    expect(shouldRequestAd(config(), afterOneEpisode, input())).toBe(true);
  });

  it('etkin olmayan yerleşim için reklam istemez', () => {
    expect(
      shouldRequestAd(config(), afterOneEpisode, input({ placement: 'preroll' })),
    ).toBe(false);
  });

  it('çok kısa bölümlerde reklam göstermez', () => {
    expect(
      shouldRequestAd(config({ minEpisodeDurationSec: 120 }), afterOneEpisode, input({ episodeDurationSec: 60 })),
    ).toBe(false);
  });

  it('N bölümde bir kuralına uyar', () => {
    const cfg = config({ everyNEpisodes: 3 });
    let state = INITIAL_AD_POLICY_STATE;

    state = onEpisodeCompleted(state); // 1. bölüm
    expect(shouldRequestAd(cfg, state, input())).toBe(false);

    state = onEpisodeCompleted(state); // 2. bölüm
    expect(shouldRequestAd(cfg, state, input())).toBe(false);

    state = onEpisodeCompleted(state); // 3. bölüm
    expect(shouldRequestAd(cfg, state, input())).toBe(true);
  });

  it('reklam gösterildikten sonra sayaç sıfırlanır', () => {
    const cfg = config();
    const shown = onAdShown(afterOneEpisode, 1_000_000);

    // Sayaç sıfırlandı: bir sonraki bölüm bitmeden reklam istenmez.
    expect(shouldRequestAd(cfg, shown, input())).toBe(false);

    const next = onEpisodeCompleted(shown);
    expect(shouldRequestAd(cfg, next, input({ nowMs: 2_000_000 }))).toBe(true);
  });

  it('asgari süre dolmadan ikinci reklamı engeller', () => {
    const cfg = config({ minIntervalMs: 5 * 60_000 });
    const shown = onEpisodeCompleted(onAdShown(afterOneEpisode, 1_000_000));

    // 1 dakika sonra: çok erken.
    expect(shouldRequestAd(cfg, shown, input({ nowMs: 1_060_000 }))).toBe(false);
    // 6 dakika sonra: uygun.
    expect(shouldRequestAd(cfg, shown, input({ nowMs: 1_360_000 }))).toBe(true);
  });
});
