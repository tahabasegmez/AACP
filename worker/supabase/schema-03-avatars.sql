-- AACP — Şema 03: profil fotoğrafı deposu
--
-- `schema-02`den SONRA, Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir.

-- ============================================================================
-- Avatar kovası
-- ============================================================================
-- Kova GENEL okumaya açıktır: profil fotoğrafı gizli veri değildir ve
-- uygulamanın her yerinde (liste satırı, panel) imzalı adres üretmeden
-- gösterilebilmelidir. İmzalı adres üretmek her görüntüleme için sunucuya
-- uğramak demekti.
--
-- YAZMA yalnızca sunucudan yapılır (Worker servis anahtarıyla yazar ve RLS'i
-- bypass eder). İstemciye yazma politikası TANIMLANMAZ — kullanıcının
-- başkasının yoluna dosya koyabilmesi kabul edilemez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  614400, -- 600 KB; istemci fotoğrafı zaten 512 px'e küçültür
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Genel okuma politikası. Kova `public` olsa da storage.objects üzerinde RLS
-- açıktır; okuma izni açıkça verilir.
drop policy if exists "avatars: herkes okur" on storage.objects;
create policy "avatars: herkes okur"
  on storage.objects for select
  using (bucket_id = 'avatars');
