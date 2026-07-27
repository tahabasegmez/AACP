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

/**
 * Kimlik değişince TÜM kullanıcı verisi yeniden çekilmelidir: farklı bir hesaba
 * geçildiğinde eski kullanıcının listeleri/ilerlemesi ekranda kalmamalı.
 */
const useAfterIdentityChange = () => {
  const qc = useQueryClient();
  const { sync } = useDependencies();
  return async () => {
    // Önce sunucuyla eşitle (yeni hesabın verisi insin), sonra her şeyi tazele.
    if (sync?.enabled) {
      await sync.syncAll().catch(() => undefined);
    }
    await qc.invalidateQueries();
  };
};

export const useRegister = () => {
  const { userRepository } = useDependencies();
  const afterChange = useAfterIdentityChange();
  return useMutation({
    mutationFn: async (input: CredentialsInput) =>
      unwrap(await userRepository.register(input)),
    onSuccess: afterChange,
  });
};

export const useSignIn = () => {
  const { userRepository } = useDependencies();
  const afterChange = useAfterIdentityChange();
  return useMutation({
    mutationFn: async (input: CredentialsInput) => unwrap(await userRepository.signIn(input)),
    onSuccess: afterChange,
  });
};

export const useSignOut = () => {
  const { userRepository } = useDependencies();
  const afterChange = useAfterIdentityChange();
  return useMutation({
    mutationFn: async () => unwrap(await userRepository.signOut()),
    onSuccess: afterChange,
  });
};

export const useUpdateProfile = () => {
  const { userRepository } = useDependencies();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { displayName?: string }) =>
      unwrap(await userRepository.updateProfile(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.currentUser }),
  });
};
