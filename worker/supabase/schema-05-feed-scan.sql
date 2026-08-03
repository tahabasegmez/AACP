-- AACP — Şema 05: feed taramasının durum kaydı
--
-- `schema-04`ten SONRA, Supabase Studio → SQL Editor'da BİR KEZ çalıştırın.
-- Tekrar çalıştırmak güvenlidir.
--
-- NEDEN: tarama her turda her feed'i baştan indiriyordu. Feed'lerin ezici
-- çoğunluğu iki tur arasında DEĞİŞMEZ; koşullu istek (`If-None-Match` /
-- `If-Modified-Since`) sunucudan 304 alır ve indirme, ayrıştırma, yazma
-- adımlarının tamamı atlanır. Bunun için yayıncının verdiği doğrulayıcıların
-- şov başına saklanması gerekir.

alter table public.shows
  -- Yayıncının sürüm etiketi. Değişmediyse içerik de değişmemiştir.
  add column if not exists feed_etag text,
  -- ETag vermeyen yayıncılar için ikinci doğrulayıcı.
  add column if not exists feed_modified text,
  -- Son başarılı kontrol — gözlemlenebilirlik ve "hangi feed takıldı" sorusu için.
  add column if not exists feed_checked_at timestamptz,
  -- Üst üste başarısız deneme sayısı. Sürekli hata veren feed daha seyrek
  -- denenebilsin diye tutulur; sıfırlanması ilk başarıda olur.
  add column if not exists feed_failures integer not null default 0;
