import { AppError, Result, fail } from '@core/error';
import { AudioPlayerService } from '../../services';
import { UseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

export interface SetPlaybackRateParams {
  /** Oynatma hızı (ör. 1.0, 1.25, 1.5, 2.0). */
  readonly rate: number;
}

/** Desteklenen hız aralığı — makul sınırlar dışına çıkılmasını engeller. */
const MIN_RATE = 0.5;
const MAX_RATE = 3;

/** SetPlaybackRate — oynatma hızını ayarlar. */
export class SetPlaybackRate implements UseCase<SetPlaybackRateParams, void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(params: SetPlaybackRateParams): Promise<Result<void>> {
    if (
      !Number.isFinite(params.rate) ||
      params.rate < MIN_RATE ||
      params.rate > MAX_RATE
    ) {
      return Promise.resolve(
        fail(
          AppError.from(
            `Geçersiz oynatma hızı: ${params.rate} (${MIN_RATE}-${MAX_RATE} arası olmalı)`,
            'PLAYBACK',
          ),
        ),
      );
    }
    return runPlayback(() => this.player.setRate(params.rate));
  }
}
