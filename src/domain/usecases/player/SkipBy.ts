import { Result } from '@core/error';
import { AudioPlayerService } from '../../services';
import { UseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

export interface SkipByParams {
  /** Kaydırma miktarı (saniye). İleri için pozitif, geri için negatif. */
  readonly offsetSec: number;
}

/**
 * SkipBy — mevcut konumdan ileri/geri atlar (ör. +30sn / -15sn).
 *
 * Podcast oynatıcılarının klasik "30 saniye ileri / 15 saniye geri" butonları
 * için. Anlık konumu player'dan okur, hedefi hesaplar, 0'ın altına inmez.
 */
export class SkipBy implements UseCase<SkipByParams, void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(params: SkipByParams): Promise<Result<void>> {
    return runPlayback(async () => {
      const state = await this.player.getState();
      const target = Math.max(0, state.positionSec + params.offsetSec);
      await this.player.seekTo(target);
    });
  }
}
