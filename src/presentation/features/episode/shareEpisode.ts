import { Share } from 'react-native';
import { env } from '@core/config';
import { Episode, Show, shareUrl } from '@domain/entities';

/**
 * Bölüm/şov paylaşımı.
 *
 * Paylaşılan metin bir **https** bağlantısı taşır: bağlantıya dokunan kişide
 * uygulama kuruluysa doğrudan ilgili bölüm açılır, kurulu değilse tanıtım
 * sayfası görünür (bkz. worker `routes/share.ts`). Özel şema (`aacp://`)
 * doğrudan paylaşılsaydı, uygulaması olmayan kişide bağlantı hiçbir şey
 * açmazdı.
 *
 * Sunucu adresi yoksa (tamamen yerel kurulum) bağlantı üretilemez; bu durumda
 * yalnızca başlık paylaşılır — paylaşımı büsbütün engellemek gereksiz olurdu.
 */
const PUBLISHER = 'Anadolu Ajansı Podcast';

export const shareEpisode = async (episode: Episode): Promise<void> => {
  const link = env.apiBaseUrl
    ? shareUrl(env.apiBaseUrl, {
        kind: 'episode',
        showId: episode.showId,
        episodeId: episode.id,
      })
    : undefined;

  await present(`${episode.title} — ${PUBLISHER}`, link);
};

export const shareShow = async (show: Show): Promise<void> => {
  const link = env.apiBaseUrl
    ? shareUrl(env.apiBaseUrl, { kind: 'show', showId: show.id })
    : undefined;

  await present(`${show.title} — ${PUBLISHER}`, link);
};

/** Paylaşım sayfasını açar; kullanıcı vazgeçerse sessizce geçilir. */
const present = async (title: string, link?: string): Promise<void> => {
  try {
    await Share.share({ message: link ? `${title}\n${link}` : title });
  } catch {
    // Paylaşım iptal edildi ya da açılamadı — akışı kesmez.
  }
};
