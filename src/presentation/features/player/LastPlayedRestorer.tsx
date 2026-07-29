import { useEffect, useRef } from 'react';
import { Episode, PlaybackProgress } from '@domain/entities';
import { useDependencies } from '../../di';
import { usePlayerStore } from '../../stores';
import { useCurrentUser } from '../../query';

/** Kaldığın-yer kaydından çalınabilir bir bölüm kurar. */
const toEpisode = (p: PlaybackProgress): Episode => ({
  id: p.episodeId,
  showId: p.showId ?? '',
  title: p.episodeTitle ?? 'Bölüm',
  description: '',
  audioUrl: p.audioUrl ?? '',
  durationSec: p.durationSec,
  publishedAt: '',
  imageUrl: p.artworkUrl,
});

/**
 * LastPlayedRestorer — "en son dinlenen bölüm"ü mini player'a geri yükler.
 *
 * Kullanıcı uygulamayı kapatıp açtığında ya da HESABINA GİRİŞ YAPTIĞINDA, o
 * hesabın en son dinlediği bölüm mini player'da hazır bekler (çalmaya
 * başlamaz — yalnızca yüklenir). Böylece "kaldığım yerden devam" tek dokunuş
 * uzakta olur ve cihaz değiştirince oturum kaldığı yerden sürer.
 *
 * Kimlik değiştiğinde yeniden çalışır: senkron sonrası inen kayıtlar arasından
 * EN SON güncellenen seçilir, dolayısıyla mini player yeni hesabın son
 * dinlediğini gösterir.
 *
 * Zaten bir bölüm çalıyorsa DOKUNMAZ — kullanıcının aktif dinlemesini kesmek
 * kabul edilemez.
 */
export const LastPlayedRestorer: React.FC = () => {
  const { getResumeList } = useDependencies();
  const setCurrentEpisode = usePlayerStore(s => s.setCurrentEpisode);
  const { data: user } = useCurrentUser();

  // Aynı kimlik için tekrar tekrar geri yükleme yapılmaz.
  const restoredFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    const identity = user?.id ?? 'anonim';
    if (restoredFor.current === identity) {
      return;
    }
    restoredFor.current = identity;

    let cancelled = false;

    void getResumeList
      .execute()
      .then(result => {
        if (cancelled || !result.ok) {
          return;
        }
        // Aktif bir oynatma varsa karışma.
        if (usePlayerStore.getState().currentEpisode) {
          return;
        }
        // En son güncellenen kayıt = en son dinlenen bölüm.
        const latest = [...result.value]
          .filter(p => p.audioUrl)
          .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];

        if (latest) {
          setCurrentEpisode(toEpisode(latest));
        }
      })
      .catch(() => {
        /* geri yükleme başarısızsa uygulama normal çalışır */
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, getResumeList, setCurrentEpisode]);

  return null;
};
