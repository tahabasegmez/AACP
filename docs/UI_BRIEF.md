# UI Yönergesi (Brief) — AACP

Bu belge, Spotify'dan esinlenilmiş arayüzü **tam istediğin gibi** yapabilmem için
doldurman gereken karar listesidir. Her maddede **seçenekler** ve **önerim** var;
kısaca "1 → b", "5 → kendi cevabım …" şeklinde yanıtlaman yeterli.

Cevaplamadığın maddelerde **önerimi uygularım** — yani hiçbir yeri boş bırakmak
işi durdurmaz, sadece kontrolü bana devretmiş olursun.

---

## A. Marka ve genel yön

**A1. Kurumsal renk**
Kodda şu an placeholder bir AA kırmızısı var (`#C8102E`).
- (a) Doğru kodu vereceğim / marka kılavuzu göndereceğim
- (b) Sen web sitesinden örnekle, uygun bir kırmızı seç
- **Önerim:** (a) — kurumsal iş, doğru kod önemli.

**A2. Karakter / ton**
- (a) **Haber ajansı ciddiyeti**: sakin, bilgi yoğun, az animasyon
- (b) **Modern medya**: Spotify'a yakın, canlı, kapak görseli merkezli
- (c) Dengeli: Spotify düzeni + AA'nın ciddi tonu
- **Önerim:** (c)

**A3. Spotify'dan neyi almalıyız?** (birden fazla seçebilirsin)
- Koyu tema ağırlığı · Kapak-merkezli kartlar/grid · Alt sekme çubuğu ·
  Mini player · Tam ekran player · Yatay "devam et" satırları · Yuvarlak köşeler
- **Önerim:** hepsi (accent rengi Spotify yeşili yerine AA kırmızısı).

---

## B. Tema ve renk

**B1. Tema desteği**
- (a) Sadece koyu (Spotify gibi)
- (b) Koyu + açık, sistem ayarına uyar
- (c) Sadece açık
- **Önerim:** (b), varsayılan koyu.

**B2. Arka plan derinliği**
- (a) Düz tek renk
- (b) Katmanlı (sayfa / kart / yükseltilmiş yüzey farklı tonlar)
- (c) Şov detayında kapak renginden türeyen degrade (Spotify'daki gibi)
- **Önerim:** (b) + şov detayı ve player'da (c).

---

## C. Tipografi

**C1. Font**
- (a) Sistem fontu (iOS'ta SF Pro) — en hızlı, en "yerli" his
- (b) Özel font (Inter / Manrope gibi)
- (c) AA'nın kurumsal fontu (dosyaları vereceğim)
- **Önerim:** (a); kurumsal font varsa (c).

**C2. Dinamik yazı boyutu (kullanıcı sistemde fontu büyütürse)**
- (a) Destekle (erişilebilirlik için önemli)
- (b) Sabit boyutlar
- **Önerim:** (a)

---

## D. Navigasyon yapısı

**D1. Alt sekme çubuğu (tab bar) kaç sekme?**
- (a) 3 sekme: **Ana Sayfa · Ara · Kütüphane** (Spotify düzeni)
- (b) 4 sekme: Ana Sayfa · Şovlar · Ara · Kütüphane
- (c) Sekme yok, tek akış (basit)
- **Önerim:** (a)

**D2. "Kütüphane" ne içersin?**
- Takip edilen şovlar · İndirilenler · Dinleme geçmişi · Sonra dinle (kaydedilenler)
- **Önerim:** Takip edilenler + İndirilenler + Geçmiş.

**D3. Ayarlar nerede?**
- (a) Ana sayfa sağ üstte dişli ikonu
- (b) Kütüphane içinde
- **Önerim:** (a)

---

## E. Ekranlar — içerik ve düzen

**E1. Ana Sayfa** (hangi bölümler, hangi sırada?)
- "Dinlemeye devam" (yatay kartlar) — *veri hazır*
- "Tüm şovlar" (2 sütun grid, kare kapaklar)
- "Yeni bölümler" (tüm şovlardan en yeniler, dikey liste)
- Öne çıkan/banner alanı
- **Önerim:** Devam et → Yeni bölümler → Tüm şovlar. (Banner'ı sonraya bırakalım.)

**E2. Şov Detay**
- Büyük kapak + başlık + yazar + açıklama (uzunsa "devamını gör")
- "Takip et" butonu olsun mu? (Kütüphane'yi besler)
- Bölüm listesi + arama/sıralama (**altyapı hazır**)
- **Önerim:** Hepsi, "Takip et" dahil.

**E3. Bölüm ayrıntısı** (açıklama uzun olabiliyor, HTML içeriyor)
- (a) Ayrı tam ekran
- (b) Alttan açılan panel (bottom sheet)
- (c) Sadece listede kısa özet, ayrı ekran yok
- **Önerim:** (b)

**E4. Tam ekran Player** — hangi kontroller?
- Kapak · başlık/şov · seek slider · ±15/30 sn · oynat/duraklat · hız ·
  uyku zamanlayıcısı · paylaş · kuyruk · indir · bölüm notları
- **Önerim:** Kapak, slider, ±15/30, oynat/duraklat, hız, paylaş, bölüm notları.
  (Kuyruk ve uyku zamanlayıcısı ikinci turda.)

**E5. Mini Player**
- (a) Olsun — tab bar üstünde sabit, tıklayınca tam ekrana açılır
- (b) Olmasın
- **Önerim:** (a) — podcast uygulamasında neredeyse zorunlu.

**E6. Arama**
- (a) Sadece şov adı
- (b) Şov + bölüm (tüm şovlarda)
- (c) (b) + son aramalar geçmişi
- **Önerim:** (b); (c) kolay eklenir.
  *Not: bölüm araması şu an tek şov içinde hazır; tüm şovlarda arama ek iş.*

---

## F. Liste ve kart tasarımı

**F1. Şov kartı (ana sayfa grid)**
- (a) Kare kapak + altında başlık
- (b) Kare kapak + başlık + yazar
- (c) Sadece kapak (başlık kapağın üstünde)
- **Önerim:** (b)

**F2. Bölüm satırında ne görünsün?**
- Tarih · başlık · süre · ilerleme çubuğu (yarım kalanlarda) · oynat butonu ·
  indir butonu · "dinlendi" işareti
- **Önerim:** Tarih, başlık, süre, ilerleme çubuğu, dinlendi işareti.

**F3. Kapak görselleri**
- Transistor CDN'den geliyor (webp, 800px). Placeholder/blur geçişi olsun mu?
- **Önerim:** Evet — yumuşak fade-in + AA logolu fallback.

---

## G. Durumlar ve geri bildirim

**G1. Yüklenme**
- (a) Spinner (şu anki)
- (b) **Skeleton** (içerik iskeleti — Spotify tarzı)
- **Önerim:** (b)

**G2. Hata / boş durum**
- Şu an sade metin var. İllüstrasyon/ikon eklensin mi?
- **Önerim:** İkon + kısa mesaj + "Tekrar dene".

**G3. Çevrimdışı**
- Üstte kalıcı bir "çevrimdışısın" şeridi olsun mu?
- **Önerim:** Evet (indirilenler özelliği gelince daha da anlamlı).

---

## H. Hareket ve animasyon

**H1. Animasyon seviyesi**
- (a) Minimal (sadece geçişler)
- (b) Orta (mini↔tam player geçişi, kapak paylaşımlı geçiş, yumuşak fade)
- (c) Zengin (jest tabanlı sürüklemeler, paralaks)
- **Önerim:** (b)

---

## I. Erişilebilirlik

**I1.** VoiceOver etiketleri, min 44pt dokunma alanı, WCAG AA kontrast
- **Önerim:** Baştan uygula (sonradan eklemek 3 kat pahalı).

---

## J. Dil

**J1. Uygulama dili**
- (a) Sadece Türkçe
- (b) Türkçe + İngilizce (i18n altyapısıyla)
- *Not: "Anadolu Talk Zone" şovu İngilizce içerikli.*
- **Önerim:** (a) şimdilik, ama metinleri tek dosyada topla ki (b)'ye geçiş kolay olsun.

---

## K. İkonlar ve görsel varlıklar

**K1. İkon seti**
- (a) `react-native-vector-icons` (hazır, geniş)
- (b) Özel SVG seti (tasarımcıdan)
- **Önerim:** (a); marka ikonları gelirse (b) ile değiştiririz.

**K2. Benden gerekenler**
- [ ] AA logo (SVG veya yüksek çözünürlüklü PNG)
- [ ] Uygulama ikonu (1024×1024)
- [ ] Kurumsal renk kodları / marka kılavuzu
- [ ] Varsa Figma/tasarım dosyası
- [ ] Beğendiğin referans ekran görüntüleri (Spotify veya başka uygulama)

---

## L. CarPlay arayüzü (ayrı yüzey)

**L1.** Şu an: düz şov listesi → bölüm listesi → Now Playing.
- (a) Böyle kalsın
- (b) Sekmeli yap: **Devam Et · Şovlar** (sürüş sırasında daha hızlı)
- (c) (b) + listelerde kapak görselleri
- **Önerim:** (c)

---

## M. Performans

**M1. Uzun listeler** (bazı şovlarda 1900+ bölüm)
- (a) `FlatList` (mevcut) + sayfalama — şu an çalışıyor
- (b) `@shopify/flash-list`'e geç (çok daha akıcı)
- **Önerim:** (b) — kapak görselli ağır satırlarda fark büyük.

**M2. Görsel önbelleği**
- (a) RN `Image` (varsayılan)
- (b) `expo-image` / `react-native-fast-image` (disk cache, daha iyi)
- **Önerim:** (b)

---

## N. Kapsam ve öncelik

**N1. İlk turda (MVP) hangi ekranlar bitsin?**
- **Önerim:** Tasarım sistemi → Ana Sayfa → Şov Detay → Player + Mini Player.
  (Arama, Kütüphane, İndirilenler ikinci tur.)

**N2. Nasıl ilerleyelim?**
- (a) Önce tasarım sistemi + 1 ekran → onayına sun → sonra devamı
- (b) Hepsini yapıp topluca göster
- **Önerim:** (a) — yön hatasını erken yakalarız.

---

## Hızlı cevap şablonu

Aşağıyı kopyalayıp doldurman yeterli:

```
A1: ...   A2: ...   A3: ...
B1: ...   B2: ...
C1: ...   C2: ...
D1: ...   D2: ...   D3: ...
E1: ...   E2: ...   E3: ...   E4: ...   E5: ...   E6: ...
F1: ...   F2: ...   F3: ...
G1: ...   G2: ...   G3: ...
H1: ...   I1: ...   J1: ...   K1: ...
L1: ...   M1: ...   M2: ...
N1: ...   N2: ...
Ek notlar / referanslar:
```
