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
 * hesabın en son dinlediği bölüm mini player'da **kaldığı yerde** hazır bekler.
 * Ses YÜKLENMEZ: açılışta ağa çıkmak ya da dosya açmak gereksiz; kayıttaki
 * konum/süre yalnızca göstergeye yazılır. Dokunulduğunda `togglePlay` bölümün
 * oynatıcıda olmadığını görüp kaldığı yerden başlatır.
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
  const setPlayback = usePlayerStore(s => s.setPlayback);
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

        if (!latest) {
          return;
        }
        // Yalnızca GÖSTERİM kurulur; kuyruğa DOKUNULMAZ. Kuyruk oynatıcıda
        // yaşar ve onu doldurmak sesi yüklemek demektir — açılışta ağa çıkmak
        // ya da dosya açmak gereksiz. Kullanıcı oynata bastığında `togglePlay`
        // bölümü kuyruğa alıp kaldığı yerden başlatır.
        usePlayerStore.getState().setCurrentEpisode(toEpisode(latest));
        // Kaldığı yer göstergeye de yazılır; aksi halde ilerleme çubuğu
        // sıfırdan başlıyor gibi görünürdü. Durum 'idle' kalır: ses henüz
        // oynatıcıya yüklenmedi ve bunu `togglePlay` bu bilgiden anlar.
        setPlayback({
          ...usePlayerStore.getState().playback,
          positionSec: latest.positionSec,
          durationSec: latest.durationSec,
        });
      })
      .catch(() => {
        /* geri yükleme başarısızsa uygulama normal çalışır */
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, getResumeList, setPlayback]);

  return null;
};
