-- Analytics view produk di etalase sendiri (swakelola, bukan gtag/plausible).
--
-- KENAPA TABEL TERPISAH, bukan menumpang sales_events: sales_events mencatat
-- performa CHANNEL MARKETPLACE — views/clicks/orders/revenue per Shopee,
-- Tokopedia, TikTok. Traffic etalase sendiri adalah metrik yang berbeda jenis,
-- dan dashboard marketplace punya daftar channel tetap berisi tiga. Menyuntikkan
-- "storefront" ke sana akan mencampur dua hal yang tidak sebanding dan memaksa
-- setiap agregasi channel memikirkan pengecualian.
--
-- BENTUKNYA AGREGAT, BUKAN SATU BARIS PER VIEW. Kuncinya (product_ref,
-- view_date) dengan penghitung, di-UPSERT. Satu baris per view akan tumbuh
-- tanpa batas mengikuti jumlah pengunjung; agregat ini terbatas pada
-- jumlah_produk × jumlah_hari, dan itulah satu-satunya granularitas yang
-- dibutuhkan readout "produk paling dilihat per rentang tanggal".
--
-- PRIVASI: tidak menyimpan siapa yang melihat — tidak ada user_id, tidak ada IP,
-- tidak ada sesi. Hanya "produk X dilihat N kali pada tanggal T". Metrik traffic
-- yang tidak bisa dilacak balik ke individu tidak butuh batas simpan maupun
-- pertimbangan data pribadi.
--
-- Idempoten: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.product_view_stats (
  product_ref text NOT NULL,
  view_date   date NOT NULL,
  views       integer NOT NULL DEFAULT 0,
  PRIMARY KEY (product_ref, view_date)
);

CREATE INDEX IF NOT EXISTS product_view_stats_date_idx ON public.product_view_stats (view_date);

ALTER TABLE public.product_view_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS product_views_read ON public.product_view_stats;

-- Hanya admin yang boleh MEMBACA. Tidak ada policy tulis: penambahan terjadi
-- lewat klien service di server function, sama seperti audit_logs. Pengunjung
-- yang memicu view tidak pernah menyentuh tabel ini langsung.
CREATE POLICY product_views_read ON public.product_view_stats FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.product_view_stats OWNER TO inipilihanku;

GRANT SELECT ON public.product_view_stats TO inipilihanku_app;
REVOKE INSERT, UPDATE, DELETE ON public.product_view_stats FROM inipilihanku_app;

/*
 * Menambah satu view. Dipanggil server function saat halaman produk dibuka.
 *
 * UPSERT dengan penambahan, jadi hari pertama sebuah produk dilihat membuat
 * barisnya, dan view berikutnya menaikkan penghitungnya. Tidak ada kondisi
 * balapan: ON CONFLICT ... DO UPDATE menjalankan penambahan secara atomik di
 * dalam satu pernyataan.
 */
CREATE OR REPLACE FUNCTION public.catat_view_produk(_product_ref text)
RETURNS void
LANGUAGE sql
AS $$
  INSERT INTO public.product_view_stats (product_ref, view_date, views)
  VALUES (_product_ref, (now() AT TIME ZONE 'Asia/Jakarta')::date, 1)
  ON CONFLICT (product_ref, view_date)
  DO UPDATE SET views = public.product_view_stats.views + 1;
$$;

ALTER FUNCTION public.catat_view_produk(text) OWNER TO inipilihanku;
