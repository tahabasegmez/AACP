# Kullanıcı tercihleri

Kullanıcının bir ekranda verdiği ve bir dahaki sefere hatırlanmasını beklediği
kararlar (ör. bir filtreyi açık bırakmak).

**Misafir ile hesap arasında davranış farkı yoktur.** Tercih cihazda saklanır;
kullanıcı hesap açtığında aynı kayıtlar hesabına taşınır ve diğer cihazlarına
iner. Arayüz bu ayrımı hiç bilmez.

## 1. Katmanlar

```
Preferences (entity)                       ← domain: ne var, varsayılanı ne
  └─ PreferencesRepository (port)          ← domain: nasıl okunur/yazılır
       └─ PreferencesRepositoryImpl        ← data: cihazda (KeyValueStorage)
       └─ PreferencesSyncAdapter           ← data: hesapla senkron
            └─ GetPreferences / SetPreference   ← domain use case
                 └─ usePreference(key)          ← presentation
```

Depolamanın nerede olduğu portun arkasındadır. İleride kullanıcı kitlesi
büyüyüp tercihler sunucuda ayrı bir şemaya (NoSQL / ilişkisel) taşındığında
**yalnızca implementasyon** değişir: entity, use case ve arayüz aynı kalır.

## 2. Yeni tercih eklemek

1. [`Preferences`](../src/domain/entities/Preferences.ts) arayüzüne bir alan,
2. `DEFAULT_PREFERENCES`'a varsayılanı.

Depolama, senkron ve arayüz tarafı kendiliğinden çalışır.

> Şu an yalnızca boolean tercihler desteklenir (`PreferencesSyncAdapter`
> uzak değeri doğrularken bunu bekler). Başka bir tür gerektiğinde doğrulama
> oraya eklenir — bozuk/eski bir kaydın tercihleri kirletmemesi için tür
> kontrolü bilinçlidir.

## 3. Neden alan bazında?

Kayıtlar tek bir JSON blobu olarak DEĞİL, tercih başına ayrı ayrı tutulur ve
her birinin kendi değişiklik zamanı vardır:

```json
{ "hideCompletedEpisodes": { "value": true, "updatedAt": 1753900000000 } }
```

Blok hâlinde yazılsaydı, telefonda bir tercihi değiştirmek tablette değiştirilen
başka bir tercihi sessizce geri alırdı. Senkronda son-yazan-kazanır kuralı bu
sayede **alan bazında** uygulanır.

## 4. Mevcut tercihler

| Alan | Anlamı | Nerede |
|---|---|---|
| `hideCompletedEpisodes` | Şov detayında dinlenmiş bölümleri gizle | Şov detayı, arama kutusunun altındaki düğme |

---

# Dinlenme durumu ("dinlendi" işareti)

Bir bölümün dinlenip dinlenmediği **her yüzeyde aynı kaynaktan** okunur.

## Ne zaman "dinlendi" sayılır?

- **Otomatik:** bölümün %90'ı dinlendiğinde
  ([`COMPLETION_THRESHOLD`](../src/domain/entities/PlaybackProgress.ts)). Sondaki
  jenerik/kapanış anonsu dinlenmese de bölüm bitmiş sayılmalı.
- **Elle:** bölüm panelindeki "Dinlendi say" / "Dinlenmedi say".
  İşareti kaldırmak kaydı **tümüyle siler** — bölüm hiç açılmamış hâline döner.
  Konumu koruyup yalnızca bayrağı düşürmek, kullanıcının bilerek kapattığı
  bölümü "Dinlemeye devam"da geri getirirdi.

## Nasıl gösterilir?

| Yüzey | Gösterim |
|---|---|
| Dikey liste (şov, liste, indirilenler, Tümü) | Meta satırında `✓ dinlendi`, satır %50 opaklıkta |
| Yatay kart (ana sayfa rafları) | Kapağın köşesinde çentik rozeti, kart %55 opaklıkta |
| Çalan bölüm | Soluklaştırılmaz — dikkat çekmeli |

## Neden prop değil hook?

Durumu ekranlar boyunca prop olarak taşımak, yeni bir liste eklendiğinde işareti
unutmaya açıktı — nitekim "dinlendi" yazısı yalnızca şov detayında görünüyordu.
Artık satırın kendisi soruyor:

- [`useEpisodeStatus(episodeId)`](../src/presentation/features/player/useEpisodeStatus.ts)
  → `{ completed, fraction, started }`
- [`useNowPlaying(episodeId)`](../src/presentation/features/player/useNowPlaying.ts)
  → `{ isCurrent, isPlaying }`

Kayıtlar tek sorguda indekslenir (`useProgressIndex`); her satırın ayrı ayrı
depoya sorması listeleri yavaşlatırdı.
