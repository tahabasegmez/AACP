import { KeyValueStorage } from '@core/ports';
import { MembershipSyncAdapter } from './MembershipSyncAdapter';

/** FollowRepositoryImpl ile AYNI anahtar — tek veri kaynağı. */
const FOLLOWS_KEY = 'followed_shows_v1';

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

/*
 * NOT: "Sonra dinle" için ayrı bir adaptör YOKTUR.
 *
 * O liste artık playlist sisteminin sistem listesidir (`SAVED_PLAYLIST_ID`) ve
 * `playlists` koleksiyonu içinde senkronlanır. Ayrı bir adaptör aynı veriyi
 * iki kez taşır ve kaynakların sapmasına yol açardı.
 */
