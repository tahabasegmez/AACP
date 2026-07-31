-- AACP — Şema 02: katalog, profil ve ödeme
--
-- `schema.sql`'den SONRA, Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- BURADAKİ VERİ NEDEN POSTGRES'TE?
-- Bu tablolar ilişkiseldir, sorgulanır ve denetlenir: katalog yönetilir ve
-- sıralanır, ödemeler işlem bütünlüğü ve denetim izi ister, takipler
-- "bu şovu kimler takip ediyor" sorusuna cevap verir. Anahtar-değer bir
-- depoda bunların hiçbiri makul maliyetle yapılamaz.
--
-- Yüksek hacimli, ilişkisiz kullanıcı durumu (kaldığın yer, tercihler)
-- BURADA DEĞİLDİR; bkz. docs/VERI-MIMARISI.md.

-- ============================================================================
-- 1. Şov kataloğu
-- ============================================================================
-- Katalog artık uygulamaya gömülü bir dosya ya da `settings` içinde tek satır
-- JSON değil, kendi tablosudur: şov eklemek/çıkarmak bir satır işlemidir,
-- sıralama ve yayın durumu sorgulanabilir.
create table if not exists public.shows (
  -- Kararlı kimlik (feed slug'ı). İstemcideki `Show.id` ile aynıdır.
  slug        text primary key,
  feed_url    text not null,
  title       text not null,
  description text,
  image_url   text,
  author      text,
  language    text,
  categories  text[] not null default '{}',
  -- Yayından kaldırmak SİLMEK değildir: geçmiş dinleme kayıtları şova
  -- referans verir, satır korunur ve yalnızca listelerden düşer.
  active      boolean not null default true,
  -- Katalogdaki gösterim sırası (küçük olan üstte).
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_shows_active on public.shows (active, sort_order);

alter table public.shows enable row level security;

-- Katalog gizli veri DEĞİLDİR: uygulama oturum açmadan da listeyi görebilmeli.
drop policy if exists "shows: herkes okur" on public.shows;
create policy "shows: herkes okur"
  on public.shows for select
  using (true);
-- Yazma politikası TANIMLANMAZ → yalnızca servis anahtarı (Worker/admin) yazar.

-- ============================================================================
-- 2. Bölümler (RSS'ten türetilir)
-- ============================================================================
-- Feed'ler zaten cron ile taranıyor (yeni bölüm bildirimi). Aynı taramada
-- bölümleri de kaydetmek, ileride bölüm listesini sunucudan sunmayı,
-- sunucu tarafı aramayı ve "yeni bölümler" akışını mümkün kılar.
create table if not exists public.episodes (
  show_slug    text not null references public.shows (slug) on delete cascade,
  -- RSS guid (yoksa enclosure adresi) — feed'ler arası benzersiz değildir,
  -- bu yüzden şovla birlikte birincil anahtar oluşturur.
  guid         text not null,
  title        text not null,
  description  text,
  audio_url    text not null,
  image_url    text,
  duration_sec integer,
  published_at timestamptz,
  created_at   timestamptz not null default now(),
  primary key (show_slug, guid)
);

create index if not exists idx_episodes_published
  on public.episodes (show_slug, published_at desc nulls last);

alter table public.episodes enable row level security;

drop policy if exists "episodes: herkes okur" on public.episodes;
create policy "episodes: herkes okur"
  on public.episodes for select
  using (true);

-- ============================================================================
-- 3. Kullanıcı profili
-- ============================================================================
-- `auth.users` Supabase'e aittir ve doğrudan genişletilmez; uygulamaya ait
-- alanlar burada yaşar.
create table if not exists public.profiles (
  user_id      uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: kendi profilini görür" on public.profiles;
create policy "profiles: kendi profilini görür"
  on public.profiles for select
  using (auth.uid() = user_id);

drop policy if exists "profiles: kendi profilini yazar" on public.profiles;
create policy "profiles: kendi profilini yazar"
  on public.profiles for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Yeni kullanıcı kaydolduğunda profil satırı kendiliğinden oluşur.
create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (user_id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'name')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_profile on auth.users;
create trigger trg_create_profile
  after insert on auth.users
  for each row execute function public.create_profile_for_new_user();

-- ============================================================================
-- 4. Abonelik ve ödeme
-- ============================================================================
-- PARA VERİSİ İLİŞKİSELDİR ve asla anahtar-değer depoda tutulmaz: mutabakat
-- (kim ne zaman ne ödedi), iade takibi ve raporlama sorgu ister; ayrıca
-- kayıtlar SİLİNMEZ, yalnızca eklenir (denetim izi).
create table if not exists public.subscriptions (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  -- 'free' | 'premium'
  plan        text not null default 'free',
  -- 'active' | 'canceled' | 'expired' | 'in_grace'
  status      text not null default 'active',
  -- Sağlayıcı (App Store, Google Play, Stripe...) ve oradaki kimlik.
  provider    text,
  provider_ref text,
  renews_at   timestamptz,
  updated_at  timestamptz not null default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "subs: kendi aboneliğini görür" on public.subscriptions;
create policy "subs: kendi aboneliğini görür"
  on public.subscriptions for select
  using (auth.uid() = user_id);
-- Yazma politikası TANIMLANMAZ: abonelik durumunu YALNIZCA sunucu değiştirir
-- (sağlayıcı webhook'u). İstemcinin kendini "premium" yapabilmesi kabul edilemez.

create table if not exists public.payments (
  id           bigserial primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  -- Sağlayıcıdaki işlem kimliği; aynı webhook iki kez gelirse tekrar yazılmaz.
  provider     text not null,
  provider_ref text not null,
  amount_minor bigint not null,
  currency     text not null default 'TRY',
  -- 'succeeded' | 'refunded' | 'failed'
  status       text not null,
  occurred_at  timestamptz not null default now(),
  unique (provider, provider_ref)
);

create index if not exists idx_payments_user on public.payments (user_id, occurred_at desc);

alter table public.payments enable row level security;

drop policy if exists "payments: kendi kayıtlarını görür" on public.payments;
create policy "payments: kendi kayıtlarını görür"
  on public.payments for select
  using (auth.uid() = user_id);
-- Yazma politikası TANIMLANMAZ: yalnızca sunucu yazar.

-- ============================================================================
-- 5. Takip izdüşümü (sync_records → ilişkisel)
-- ============================================================================
-- Takipler istemciyle `sync_records` üzerinden senkronlanır (protokol
-- değişmez) ama sunucunun "bu şovu kimler takip ediyor" sorusuna ucuz cevap
-- verebilmesi gerekir — bildirim gönderimi bunu her taramada sorar.
--
-- Bu yüzden senkron kaydı ilişkisel bir tabloya İZDÜŞÜRÜLÜR. Tek yazma yolu
-- korunur (senkron), okuma tarafı ilişkisel olur.
create table if not exists public.show_follows (
  user_id    uuid not null references auth.users (id) on delete cascade,
  show_slug  text not null,
  followed_at bigint not null,
  primary key (user_id, show_slug)
);

create index if not exists idx_follows_show on public.show_follows (show_slug);

alter table public.show_follows enable row level security;

drop policy if exists "follows: kendi takiplerini görür" on public.show_follows;
create policy "follows: kendi takiplerini görür"
  on public.show_follows for select
  using (auth.uid() = user_id);

create or replace function public.project_show_follow()
returns trigger
language plpgsql
security definer
as $$
begin
  if new.collection <> 'follows' then
    return new;
  end if;

  if new.deleted then
    delete from public.show_follows
      where user_id = new.user_id and show_slug = new.key;
  else
    insert into public.show_follows (user_id, show_slug, followed_at)
    values (new.user_id, new.key, new.updated_at)
    on conflict (user_id, show_slug)
      do update set followed_at = excluded.followed_at;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_project_follow on public.sync_records;
create trigger trg_project_follow
  after insert or update on public.sync_records
  for each row execute function public.project_show_follow();

-- Tetikleyici yalnızca BUNDAN SONRAKİ yazmaları yakalar; mevcut takipler
-- bir kez geriye dönük aktarılır.
insert into public.show_follows (user_id, show_slug, followed_at)
select user_id, key, updated_at
  from public.sync_records
 where collection = 'follows' and deleted = false
on conflict (user_id, show_slug) do nothing;
