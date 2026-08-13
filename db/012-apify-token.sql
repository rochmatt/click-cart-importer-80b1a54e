-- Token API Apify (Fase 3, uji) — dipakai membaca stok/harga produk marketplace
-- lewat actor cloud Apify (nol browser di server ini). Diatur admin dari
-- Settings, disimpan di store_settings.
--
-- RAHASIA: sama seperti google_client_secret — apify_token TIDAK PERNAH ikut
-- SELECT publik getStoreSettings (yang memakai daftar kolom eksplisit); hanya
-- status "terkonfigurasi" yang dikembalikan ke admin. Idempoten.

ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS apify_token text NOT NULL DEFAULT '';
