-- AACP — Şema 04: bölüm listesinin sunucudan sayfalanması
--
-- `schema-03`ten SONRA, Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- NEDEN: istemci artık her şov açılışında 4 MB'lık RSS'i indirmiyor; bölümler
-- sunucudan sayfa sayfa geliyor. Sayfalama OFFSET ile değil İMLEÇLE (keyset)
-- yapılır: `offset 10000` sunucuyu her seferinde baştan saydırır ve derin
-- sayfalarda lineer yavaşlar; imleç ise indekste doğrudan yerini bulur.

-- ============================================================================
-- 1. Sıralama anahtarı
-- ============================================================================
-- İmleç sayfalaması, sıralanan sütunun NULL OLMAMASINI gerektirir: NULL ile
-- karşılaştırma daima yanlış döner ve tarihi çözülemeyen bölümler sayfalar
-- arasında sessizce kaybolurdu.
--
-- `published_at` yayıncı `pubDate` vermediğinde ya da tarih çözülemediğinde
-- boştur. Bu yüzden sıralama için türetilmiş, HER ZAMAN dolu bir sütun kullanılır.
-- Üretilmiş sütun seçilir (tetikleyici değil): değer satırla birlikte tutulur,
-- güncel kalması garanti edilir ve uygulama kodunun haberi olması gerekmez.
alter table public.episodes
  add column if not exists published_sort timestamptz
  generated always as (coalesce(published_at, created_at)) stored;

-- Sayfalama sorgusunun indeksi. Sıralama (published_sort, guid) çiftidir:
-- aynı saniyede yayınlanan iki bölümde sıra kararsız kalmasın ve imleç
-- bir kaydı iki kez döndürmesin ya da atlamasın.
create index if not exists idx_episodes_paging
  on public.episodes (show_slug, published_sort desc, guid desc);

create index if not exists idx_episodes_paging_asc
  on public.episodes (show_slug, published_sort asc, guid asc);

-- ============================================================================
-- 2. Şov içi arama
-- ============================================================================
-- Arama `ilike '%metin%'` ile yapılır. Baştaki joker karakter B-tree indeksini
-- kullanılamaz kılar; trigram indeksi bunu indekslenebilir hale getirir.
--
-- Tam metin araması (tsvector) yerine trigram seçilmesinin sebebi: istemcideki
-- davranış ALT DİZİ aramasıdır ("bakış" → "bir bakışta"). tsvector kelime
-- köküne göre eşleşir ve bu davranışı bozardı. Kelime kökü ve alaka sıralaması
-- gerektiğinde (transkript araması) ayrı bir arama motoru devreye girer.
create extension if not exists pg_trgm;

create index if not exists idx_episodes_title_trgm
  on public.episodes using gin (title gin_trgm_ops);

create index if not exists idx_episodes_description_trgm
  on public.episodes using gin (description gin_trgm_ops);
