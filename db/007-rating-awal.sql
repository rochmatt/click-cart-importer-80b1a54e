-- Mengisi rating dan jumlah ulasan awal pada admin_products.
--
-- MASALAH YANG DIPERBAIKI. Kolom rating dan reviews punya nilai DEFAULT (4.7
-- dan 0) dan bersifat NOT NULL. Pemetaan di src/lib/catalog.ts memakai
-- `row.rating ?? seed?.rating`, yang tidak pernah jatuh ke seed karena kolomnya
-- tidak pernah NULL. Akibatnya SETIAP produk di etalase menampilkan
-- "4.7 (0 ulasan)" — angka yang sama persis untuk delapan produk berbeda.
--
-- Sementara itu JSON-LD pada halaman produk membaca seed langsung, sehingga
-- markup yang dibaca Google menyatakan 4.8 dari 1204 ulasan untuk produk yang
-- halamannya menampilkan 4.7 dari 0 ulasan. Google menghukum agregat yang tidak
-- cocok dengan konten halaman, jadi keduanya harus berasal dari satu angka.
--
-- Angka di bawah disalin dari src/data/products.ts, dicocokkan lewat
-- catalog_ref. Ini ANGKA AWAL YANG DITENTUKAN PEMILIK TOKO, bukan hasil
-- perhitungan dari ulasan nyata — tabel ulasan memang belum ada. Begitu ulasan
-- sungguhan masuk, kedua kolom ini harus dihitung ulang dari sana dan migrasi
-- ini berhenti berlaku.
--
-- Idempoten: aman dijalankan ulang, dan hanya menyentuh baris yang catalog_ref
-- nya cocok. Produk yang dibuat lewat panel admin tidak tersentuh — produk baru
-- memang belum punya ulasan, dan menyalakan angka untuknya justru mengarang.

UPDATE public.admin_products AS p
   SET rating  = v.rating,
       reviews = v.reviews
  FROM (VALUES
    ('1', 4.8, 1204),
    ('2', 4.7,  892),
    ('3', 4.9,  342),
    ('4', 4.6, 2310),
    ('5', 4.5,  517),
    ('6', 4.8,  731),
    ('7', 4.4,  268),
    ('8', 4.7,  456)
  ) AS v(catalog_ref, rating, reviews)
 WHERE p.catalog_ref = v.catalog_ref;
