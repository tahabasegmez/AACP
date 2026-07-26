import { KeyValueStorage } from '@core/ports';
import { Episode } from '@domain/entities';
import { MembershipSyncAdapter } from './MembershipSyncAdapter';

/** FollowRepositoryImpl ile AYNI anahtar — tek veri kaynağı. */
const FOLLOWS_KEY = 'followed_shows_v1';
/** SavedEpisodesRepositoryImpl ile AYNI anahtar. */
const SAVED_KEY = 'saved_episodes_v1';

/**
 * FollowsSyncAdapter — takip edilen şov id'lerinin senkronu.
 * Üyeler düz string (showId) olduğu için kimlik ve yük aynıdır.
 */
export class FollowsSyncAdapter extends MembershipSyncAdapter<string> {
  constructor(storage: KeyValueStorage) {
    super('follows', storage, FOLLOWS_KEY);
  }

  protected idOf(item: string): string {
    return item;
  }

  protected parse(json: string): string | null {
    try {
      const parsed = JSON.parse(json) as unknown;
      return typeof parsed === 'string' && parsed.length > 0 ? parsed : null;
    } catch {
      return null;
    }
  }
}

/**
 * SavedEpisodesSyncAdapter — "sonra dinle" listesinin senkronu.
 * Üyeler tam Episode nesnesi taşır (liste, feed'e çıkmadan gösterilebilsin).
 */
export class SavedEpisodesSyncAdapter extends MembershipSyncAdapter<Episode> {
  constructor(storage: KeyValueStorage) {
    super('saved', storage, SAVED_KEY);
  }

  protected idOf(item: Episode): string {
    return item.id;
  }

  protected parse(json: string): Episode | null {
    try {
      const parsed = JSON.parse(json) as Episode;
      // Asgari doğrulama — bozuk uzak veri listeyi kirletmesin.
      if (parsed && typeof parsed.id === 'string' && typeof parsed.title === 'string') {
        return parsed;
      }
    } catch {
      /* bozuk kayıt atlanır */
    }
    return null;
  }
}
