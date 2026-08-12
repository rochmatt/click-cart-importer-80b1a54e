-- Fase 1 mesin sinkronisasi produk: melacak stok & harga produk marketplace
-- (Shopee/Tokopedia/TikTok) yang di-"grab" admin, supaya perubahan di sumber
-- ketahuan tanpa admin mengecek satu per satu.
--
-- KENAPA TABEL TERPISAH, bukan menambah kolom di admin_products:
-- admin_products punya trigger BEFORE UPDATE yang menyetel updated_at = now(),
-- sedangkan etalase mengurutkan katalog berdasarkan updated_at DESC. Kalau
-- bookkeeping sinkronisasi (waktu cek, harga sumber, hash) ditulis ke
-- admin_products, SETIAP produk yang tersinkron akan meloncat ke puncak etalase
-- tiap hari. Memisahkannya ke sini membuat penulisan rutin sinkronisasi tidak
-- menyentuh admin_products sama sekali — hanya perubahan STOK nyata
-- (sembunyikan/tampilkan) yang mengubah admin_products.status, dan itu jarang.
--
-- CATATAN HARGA: admin_products.price = harga JUAL merchant (boleh ada margin di
-- atas harga sumber), BUKAN harga sumber. Karena itu source_price disimpan
-- terpisah dan sinkronisasi TIDAK PERNAH menimpa admin_products.price/sale_price
-- — ia hanya melapor perubahannya. Menimpanya akan menghapus margin diam-diam.
--
-- Idempoten: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.product_sync_state (
  product_id      uuid PRIMARY KEY REFERENCES public.admin_products(id) ON DELETE CASCADE,
  marketplace     text,                         -- shopee | tokopedia | tiktok | null
  source_url      text,
  status          text NOT NULL DEFAULT 'idle', -- idle | ok | out_of_stock | error
  source_price    bigint,                       -- harga terakhir yang terbaca di sumber
  source_hash     text,                         -- sidik jari (harga|sale|ketersediaan) utk deteksi perubahan
  fail_count      integer NOT NULL DEFAULT 0,
  previous_status text,                         -- admin_products.status sebelum auto-sembunyi (utk pemulihan)
  last_error      text,
  last_checked_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Penjadwal mengambil "yang paling lama tidak dicek" lebih dulu, supaya satu
-- batch kecil per run tetap merotasi seluruh katalog dari waktu ke waktu.
CREATE INDEX IF NOT EXISTS product_sync_state_checked_idx
  ON public.product_sync_state (last_checked_at ASC NULLS FIRST);

ALTER TABLE public.product_sync_state ENABLE ROW LEVEL SECURITY;

-- Penulisan dilakukan lewat pool service (pemilik tabel, melewati RLS), sama
-- seperti sales_events. Policy ini hanya membuka BACA untuk admin — menyiapkan
-- dashboard pengecualian Fase 2 tanpa memberi akses ke siapa pun selain admin.
DROP POLICY IF EXISTS sync_state_read ON public.product_sync_state;
CREATE POLICY sync_state_read ON public.product_sync_state FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
