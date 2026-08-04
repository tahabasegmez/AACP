import { useCallback } from 'react';
import { unwrap } from '@core/error';
import { CredentialsInput } from '@domain/repositories';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useDependencies } from '../di';
import { queryKeys } from './queryKeys';

/**
 * O anki kullanıcı (anonim olabilir, hiç yoksa null).
 *
 * Sunucu kapalıyken de çalışır: yerel profil önbelleği döner. Bu yüzden bu
 * sorgu asla "hata" durumuna düşmez ve UI'ı bloke etmez.
 */
export const useCurrentUser = () => {
  const { userRepository } = useDependencies();
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: async () => unwrap(await userRepository.current()),
  });
};

/** Hesap işlemleri sunucu gerektirir; kapalıysa UI bölümü gizlenir. */
export const useAccountsAvailable = (): boolean => {
  const { userRepository } = useDependencies();
  return userRepository.accountsAvailable;
};

/** Giriş sırasında cihazdaki verinin ne olacağı. */
export type MergeChoice = 'adopt' | 'discard';

/**
 * Kimlik değişince TÜM kullanıcı verisi yeniden çekilmelidir: farklı bir hesaba
 * geçildiğinde eski kullanıcının listeleri/ilerlemesi ekranda kalmamalı.
 */
const useAfterIdentityChange = () => {
  const qc = useQueryClient();
  return async () => {
    await qc.invalidateQueries();
  };
};

/**
 * Cihazda sunucuya gönderilmemiş kaç değişiklik var?
 *
 * Giriş ekranı bunu, "bu cihazdaki verilerin ne olsun?" sorusunu SORMAYA GEREK
 * OLUP OLMADIĞINA karar vermek için kullanır: veri yoksa kullanıcıyı gereksiz
 * bir soruyla karşılamayız.
 */
export const useCountLocalChanges = () => {
  const { sync } = useDependencies();
  return useCallback(async (): Promise<number> => {
    if (!sync?.enabled) {
      return 0;
    }
    return sync.countPending().catch(() => 0);
  }, [sync]);
};

/**
 * Hesap oluşturma.
 *
 * Burada birleştirme SORULMAZ: sunucu mevcut anonim kullanıcıyı yükseltir
 * (aynı kimlik korunur), dolayısıyla cihazdaki veri zaten bu hesaba aittir.
 */
export const useRegister = () => {
  const { userRepository, sync } = useDependencies();
  const afterChange = useAfterIdentityChange();
  return useMutation({
    mutationFn: async (input: CredentialsInput) => {
      const user = unwrap(await userRepository.register(input));
      // Kimlik yükseltildi: yerel veri hesaba taşınır.
      await sync?.adoptLocalInto().catch(() => undefined);
      return user;
    },
    onSuccess: afterChange,
  });
};

/**
 * Var olan hesaba giriş.
 *
 * Cihazdaki veri BAŞKA bir kimliğe (anonim kullanıcıya) aittir; bu yüzden ne
 * yapılacağı çağıran tarafından belirtilir:
 *  - `adopt`  → cihazdaki veriler hesaba aktarılır (birleştirilir),
 *  - `discard`→ cihazdaki veriler silinir, hesabın verisi indirilir.
 */
export const useSignIn = () => {
  const { userRepository, sync } = useDependencies();
  const afterChange = useAfterIdentityChange();
  return useMutation({
    mutationFn: async (input: CredentialsInput & { merge?: MergeChoice }) => {
      const user = unwrap(await userRepository.signIn(input));
      if (input.merge === 'discard') {
        await sync?.replaceWithRemote().catch(() => undefined);
      } else {
        await sync?.adoptLocalInto().catch(() => undefined);
      }
      return user;
    },
    onSuccess: afterChange,
  });
};

/**
 * Çıkış.
 *
 * Cihazdaki veri hesaba aitti; misafir kullanıcıya devredilmemelidir. Bu yüzden
 * çıkışta yerel senkron verisi temizlenir. İndirilen dosyalar KORUNUR — onlar
 * cihaza özgüdür ve çevrimdışı dinlemeyi bozmamak gerekir.
 */
export const useSignOut = () => {
  const { userRepository, sync } = useDependencies();
  const afterChange = useAfterIdentityChange();
  return useMutation({
    mutationFn: async () => {
      // Önce bekleyen değişiklikleri göndermeyi dene — kullanıcı verisi kaybolmasın.
      await sync?.syncAll().catch(() => undefined);
      const result = unwrap(await userRepository.signOut());
      await sync?.clearLocalData().catch(() => undefined);
      return result;
    },
    onSuccess: afterChange,
  });
};

/**
 * Profil fotoğrafının uzun kenarı için üst sınır (px).
 *
 * Avatar en fazla birkaç yüz piksel gösterilir; daha büyüğünü yüklemek ağı ve
 * depoyu boşuna meşgul ederdi. Küçültme seçim anında yapılır.
 */
const AVATAR_MAX_SIZE = 512;

/**
 * Profil fotoğrafını değiştirir: galeriden seç → sunucuya yükle.
 *
 * İki adım TEK yerde birleştirilir; çağıran ekran ne seçiciyi ne de yükleme
 * biçimini bilir. Kullanıcı seçimi iptal ederse hiçbir şey olmaz (hata değil).
 */
export const useChangeAvatar = () => {
  const { userRepository, imagePicker } = useDependencies();
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const picked = await imagePicker.pick({
        maxSize: AVATAR_MAX_SIZE,
        withData: true,
      });
      if (!picked?.base64) {
        return null; // iptal edildi ya da seçici yok
      }
      // Tür gönderilmez: sunucu görselin türünü içerikten okur.
      return unwrap(await userRepository.uploadAvatar({ base64: picked.base64 }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.currentUser }),
  });

  return {
    run: mutation.mutateAsync,
    busy: mutation.isPending,
    available: imagePicker.available,
  };
};
