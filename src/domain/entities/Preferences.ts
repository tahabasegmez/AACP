/**
 * Preferences — kullanıcının cihazlar arası taşınan tercihleri.
 *
 * "Ayar" değil TERCİH: kullanıcının bir ekranda verdiği ve bir dahaki sefere
 * hatırlanmasını beklediği kararlar (ör. bir filtreyi açık bırakmak). Misafir
 * kullanıcıda cihazda kalır, hesap açıldığında hesaba taşınır — ikisi arasında
 * davranış farkı yoktur.
 *
 * Yeni tercih eklemek = buraya bir alan + `DEFAULT_PREFERENCES`'a bir varsayılan.
 * Depolama, senkron ve arayüz tarafı kendiliğinden çalışır: kayıtlar ALAN
 * BAZINDA tutulur (bkz. PreferencesRepository), dolayısıyla iki cihaz farklı
 * tercihleri değiştirdiğinde biri diğerini ezmez.
 */
export interface Preferences {
  /** Şov detayında dinlenmiş bölümler gizlensin mi? */
  readonly hideCompletedEpisodes: boolean;
}

/** Hiç tercih kaydedilmemişken geçerli olan değerler. */
export const DEFAULT_PREFERENCES: Preferences = {
  hideCompletedEpisodes: false,
};

/** Tercih adı — depolama ve senkron anahtarı olarak da kullanılır. */
export type PreferenceKey = keyof Preferences;

/**
 * Kaydedilmiş tek bir tercih.
 *
 * `updatedAt` senkron için şarttır: son-yazan-kazanır kuralı ALAN bazında
 * uygulanır, böylece telefonda değiştirilen bir tercih tabletteki başka bir
 * tercihi geri almaz.
 */
export interface StoredPreference {
  readonly value: Preferences[PreferenceKey];
  /** Değişiklik zamanı (epoch ms). */
  readonly updatedAt: number;
}

/** Kaydedilmiş tercihleri varsayılanların üstüne uygular. */
export const mergePreferences = (
  stored: Partial<Record<PreferenceKey, StoredPreference>>,
): Preferences => {
  const result = { ...DEFAULT_PREFERENCES };
  (Object.keys(DEFAULT_PREFERENCES) as PreferenceKey[]).forEach(key => {
    const entry = stored[key];
    // Tür uyuşmayan kayıt (eski sürüm, bozuk veri) yok sayılır: varsayılan
    // kalır ve arayüz çalışmaya devam eder.
    if (entry && typeof entry.value === typeof DEFAULT_PREFERENCES[key]) {
      result[key] = entry.value;
    }
  });
  return result;
};
