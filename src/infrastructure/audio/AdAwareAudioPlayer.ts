import { Logger } from '@core/logger';
import {
  Ad,
  AdBreak,
  AdPolicyConfig,
  AdPolicyState,
  AdTrackingEvent,
  Episode,
  INITIAL_AD_POLICY_STATE,
  PlaybackState,
  onAdShown,
  onEpisodeCompleted,
  shouldRequestAd,
} from '@domain/entities';
import { AdRepository } from '@domain/repositories';
import { AudioPlayerService } from '@domain/services';

/** Reklam ilerlemesinin hangi noktalarında çeyrek olayları ateşlenir. */
const QUARTILES: ReadonlyArray<{ at: number; event: AdTrackingEvent }> = [
  { at: 0.25, event: 'firstQuartile' },
  { at: 0.5, event: 'midpoint' },
  { at: 0.75, event: 'thirdQuartile' },
];

/**
 * AdAwareAudioPlayer — oynatıcıya reklam yeteneği ekleyen DECORATOR.
 *
 * `AudioPlayerService` portunu implement eder ve gerçek oynatıcıyı sarar. Bu
 * sayede reklam mantığı TEK bir yerde toplanır: use case'ler, UI ve CarPlay
 * hiçbir değişiklik görmez — hepsi aynı portu kullanmaya devam eder.
 *
 * Bugünkü davranış (yapılandırmayla değişir):
 *  - **Post-roll**: bölüm bitince reklam kesintisi çalınır,
 *  - **Atlanamaz**: reklam sırasında ileri sarma ve hız değişimi engellenir,
 *  - Reklam alınamazsa/kapalıysa akış hiç değişmez (şeffaf geçiş).
 *
 * Reklam çalarken dışarıya yayılan durumda `ad` alanı doludur ve
 * `currentEpisodeId` ASIL bölümü göstermeye devam eder.
 */
export class AdAwareAudioPlayer implements AudioPlayerService {
  private readonly listeners = new Set<(state: PlaybackState) => void>();
  private policyState: AdPolicyState = INITIAL_AD_POLICY_STATE;

  /** Reklam sırası: kesintideki kalan reklamlar. */
  private queue: Ad[] = [];
  private currentAd?: Ad;
  private adIndex = 0;
  private adTotal = 0;
  /** Reklam kesintisi öncesindeki bölüm — reklam bitince durumu geri vermek için. */
  private hostEpisode?: Episode;
  /** Bu reklam için ateşlenmiş izleme olayları (tekrar göndermemek için). */
  private firedEvents = new Set<string>();
  /** Aynı bölüm bitişinde birden çok kez reklam tetiklenmesini önler. */
  private handlingEnd = false;

  constructor(
    private readonly inner: AudioPlayerService,
    private readonly ads: AdRepository,
    private readonly logger: Logger,
    private readonly policy: AdPolicyConfig,
    private readonly now: () => number = () => Date.now(),
  ) {
    this.inner.subscribe(state => this.onInnerState(state));
  }

  // --- AudioPlayerService ---------------------------------------------------

  setup(): Promise<void> {
    return this.inner.setup();
  }

  async play(episode: Episode): Promise<void> {
    // Yeni bölüm çalınıyorsa varsa süregelen reklam durumu temizlenir.
    this.resetAdState();
    this.hostEpisode = episode;
    await this.inner.play(episode);
  }

  resume(): Promise<void> {
    return this.inner.resume();
  }

  pause(): Promise<void> {
    return this.inner.pause();
  }

  async stop(): Promise<void> {
    this.resetAdState();
    await this.inner.stop();
  }

  async seekTo(positionSec: number): Promise<void> {
    // Atlanamaz reklam: konum değişikliği yok sayılır.
    if (this.currentAd) {
      this.logger.debug('Reklam sırasında ileri/geri sarma engellendi');
      return;
    }
    await this.inner.seekTo(positionSec);
  }

  async setRate(rate: number): Promise<void> {
    // Reklam hızlandırılarak "atlanamaz" kuralı delinmemeli.
    if (this.currentAd) {
      return;
    }
    await this.inner.setRate(rate);
  }

  async getState(): Promise<PlaybackState> {
    return this.decorate(await this.inner.getState());
  }

  subscribe(listener: (state: PlaybackState) => void): () => void {
    this.listeners.add(listener);
    void this.getState().then(state => listener(state));
    return () => {
      this.listeners.delete(listener);
    };
  }

  // --- reklam akışı ---------------------------------------------------------

  /** İç oynatıcının her durum değişiminde çalışır. */
  private onInnerState(state: PlaybackState): void {
    if (this.currentAd) {
      this.trackProgress(state);
      if (state.status === 'ended') {
        void this.advanceAdQueue();
        return; // 'ended' dışarı sızmasın: kesinti henüz bitmedi
      }
    } else if (state.status === 'ended') {
      void this.onEpisodeEnded();
      return; // reklam kararı verilene kadar 'ended' yayınlanmaz
    }

    this.emit(this.decorate(state));
  }

  /** Bölüm bitti: politikaya göre reklam iste, yoksa 'ended' yay. */
  private async onEpisodeEnded(): Promise<void> {
    if (this.handlingEnd) {
      return;
    }
    this.handlingEnd = true;

    try {
      const episode = this.hostEpisode;
      this.policyState = onEpisodeCompleted(this.policyState);

      const allowed =
        !!episode &&
        shouldRequestAd(this.policy, this.policyState, {
          placement: 'postroll',
          episodeDurationSec: episode.durationSec,
          nowMs: this.now(),
        });

      if (allowed && episode) {
        const adBreak = await this.requestAdBreak(episode);
        if (adBreak && adBreak.ads.length > 0) {
          this.policyState = onAdShown(this.policyState, this.now());
          await this.startAdBreak(adBreak);
          return;
        }
      }

      // Reklam yok: bölüm bitişini normal şekilde bildir.
      this.emitEnded();
    } finally {
      this.handlingEnd = false;
    }
  }

  private async requestAdBreak(episode: Episode): Promise<AdBreak | null> {
    const result = await this.ads.getAdBreak({
      placement: 'postroll',
      episodeId: episode.id,
      showId: episode.showId,
      episodeDurationSec: episode.durationSec,
    });
    return result.ok ? result.value : null;
  }

  /** Kesintiyi başlatır ve ilk reklamı çalar. */
  private async startAdBreak(adBreak: AdBreak): Promise<void> {
    this.queue = [...adBreak.ads];
    this.adTotal = adBreak.ads.length;
    this.adIndex = 0;
    await this.playNextAd();
  }

  /** Sıradaki reklamı çalar; kesinti bittiyse bölüm bitişini bildirir. */
  private async playNextAd(): Promise<void> {
    const next = this.queue.shift();
    if (!next) {
      this.finishAdBreak();
      return;
    }

    this.currentAd = next;
    this.adIndex += 1;
    this.firedEvents = new Set();

    this.fire('impression', next);
    this.fire('start', next);

    try {
      // Reklam, iç oynatıcıya bölüm gibi verilir; dışarıya yayılan durumda
      // `ad` alanı dolu olduğu için üst katmanlar bunu bölüm sanmaz.
      await this.inner.play(adToEpisode(next));
    } catch (error) {
      this.logger.warn('Reklam çalınamadı, atlanıyor', error);
      this.fire('error', next);
      await this.advanceAdQueue();
    }
  }

  /** Bir reklam bitti: sıradakine geç veya kesintiyi kapat. */
  private async advanceAdQueue(): Promise<void> {
    if (this.currentAd) {
      this.fire('complete', this.currentAd);
    }
    this.currentAd = undefined;
    await this.playNextAd();
  }

  /** Kesinti tamamlandı: durumu temizle ve bölüm bitişini bildir. */
  private finishAdBreak(): void {
    this.resetAdState();
    this.emitEnded();
  }

  private resetAdState(): void {
    this.queue = [];
    this.currentAd = undefined;
    this.adIndex = 0;
    this.adTotal = 0;
    this.firedEvents = new Set();
  }

  /** Reklam ilerledikçe çeyrek olaylarını ateşler (her biri bir kez). */
  private trackProgress(state: PlaybackState): void {
    const ad = this.currentAd;
    if (!ad || state.durationSec <= 0) {
      return;
    }
    const ratio = state.positionSec / state.durationSec;
    for (const { at, event } of QUARTILES) {
      if (ratio >= at) {
        this.fire(event, ad);
      }
    }
  }

  /** İzleme olayını (bir kez) reklam sunucusuna bildirir. */
  private fire(event: AdTrackingEvent, ad: Ad): void {
    if (this.firedEvents.has(event)) {
      return;
    }
    this.firedEvents.add(event);
    const urls = ad.tracking[event];
    if (urls && urls.length > 0) {
      // Best-effort: sonucu beklemeyiz, hata oynatmayı etkilemez.
      void this.ads.trackEvent(ad.id, event, urls);
    }
  }

  // --- durum yayını ---------------------------------------------------------

  /** İç durumu, reklam bağlamıyla zenginleştirerek dışarıya uygun hale getirir. */
  private decorate(state: PlaybackState): PlaybackState {
    if (!this.currentAd) {
      return state;
    }
    return {
      ...state,
      // Reklam çalarken bile "hangi bölümdeyiz" bilgisi korunur.
      currentEpisodeId: this.hostEpisode?.id ?? state.currentEpisodeId,
      ad: {
        adId: this.currentAd.id,
        title: this.currentAd.title,
        advertiser: this.currentAd.advertiser,
        clickUrl: this.currentAd.clickUrl,
        index: this.adIndex,
        total: this.adTotal,
        skippable: false, // politika: atlanamaz
      },
    };
  }

  private emitEnded(): void {
    this.emit({
      status: 'ended',
      currentEpisodeId: this.hostEpisode?.id ?? null,
      positionSec: 0,
      durationSec: this.hostEpisode?.durationSec ?? 0,
      rate: 1,
    });
  }

  private emit(state: PlaybackState): void {
    this.listeners.forEach(listener => listener(state));
  }
}

/**
 * Reklamı, oynatıcının anlayacağı Episode şekline çevirir.
 *
 * Reklam ayrı bir "medya kaynağı" olarak modellenmediği için (portu bunun için
 * genişletmek tüm implementasyonları etkilerdi) geçici bir Episode olarak
 * sunulur. Dışarıya yayılan durumda `ad` alanı dolu olduğundan üst katmanlar
 * bunu asla gerçek bir bölüm sanmaz.
 */
const adToEpisode = (ad: Ad): Episode => ({
  id: `ad:${ad.id}`,
  showId: '',
  title: ad.title ?? 'Reklam',
  description: '',
  audioUrl: ad.mediaUrl,
  durationSec: ad.durationSec,
  publishedAt: '',
});
