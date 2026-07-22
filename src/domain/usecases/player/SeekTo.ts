import { Result } from '@core/error';
import { AudioPlayerService } from '../../services';
import { UseCase } from '../UseCase';
import { runPlayback } from './playbackResult';

export interface SeekToParams {
  /** Atlanacak hedef konum (saniye). Negatif değerler 0'a kırpılır. */
  readonly positionSec: number;
}

/** SeekTo — oynatmayı belirtilen saniyeye taşır. */
export class SeekTo implements UseCase<SeekToParams, void> {
  constructor(private readonly player: AudioPlayerService) {}

  execute(params: SeekToParams): Promise<Result<void>> {
    const target = Math.max(0, params.positionSec);
    return runPlayback(() => this.player.seekTo(target));
  }
}
