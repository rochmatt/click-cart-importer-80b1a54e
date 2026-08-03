-- Pembatas kirim-ulang email verifikasi, disimpan di database.
--
-- MASALAH YANG DIPERBAIKI: batas sebelumnya ada di dua tempat yang tidak saling
-- tahu. Klien menyimpan cooldown di localStorage (hilang saat ganti perangkat,
-- ganti browser, atau bersihkan data), server menghitung di memori proses
-- (hilang saat pm2 restart). Angkanya pun berbeda — klien 5/jam bertingkat,
-- server 3/jam datar — sehingga pengguna melihat "2 kiriman tersisa" sementara
-- server sudah berhenti mengirim sejak yang keempat, dan tetap diberi tahu
-- "berhasil" karena jawabannya sengaja seragam.
--
-- Sekarang satu sumber kebenaran, dibagi semua perangkat.
--
-- Idempoten: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS auth.email_throttle (
  kind        text NOT NULL,
  -- Selalu huruf kecil. Pemanggil yang menormalkan; kolomnya tidak memakai
  -- lower() di indeks supaya kunci primer tetap bisa dipakai ON CONFLICT.
  email       text NOT NULL,

  -- Cap waktu tiap percobaan di dalam jendela geser, terurut menaik. Array,
  -- bukan sekadar penghitung: jendela geser satu jam butuh tahu KAPAN tiap
  -- percobaan terjadi, dan penghitung jendela tetap membolehkan lonjakan dua
  -- kali kuota tepat di pergantian jendela. Panjangnya terbatas pada kuota.
  attempts    timestamptz[] NOT NULL DEFAULT '{}',

  updated_at  timestamptz NOT NULL DEFAULT now(),

  PRIMARY KEY (kind, email)
);

-- Dipakai pembersihan baris basi di bawah.
CREATE INDEX IF NOT EXISTS email_throttle_updated_idx ON auth.email_throttle (updated_at);

/*
 * Mencatat satu percobaan kirim dan memutuskan boleh atau tidak, dalam satu
 * langkah atomik.
 *
 * KENAPA FUNGSI, BUKAN BEBERAPA QUERY DARI APLIKASI: keputusannya adalah
 * baca-ubah-tulis. Dua permintaan yang datang bersamaan akan sama-sama membaca
 * "belum ada percobaan" lalu sama-sama lolos. SELECT ... FOR UPDATE di dalam
 * fungsi mengunci barisnya, dan fungsi berjalan dalam transaksinya sendiri.
 *
 * _tangga adalah cooldown bertingkat dalam detik, dipilih berdasarkan JUMLAH
 * percobaan yang sudah ada. Setelah kiriman ke-n, tunggu _tangga[n]. Indeks
 * array PostgreSQL mulai dari 1, jadi pemetaannya langsung.
 */
CREATE OR REPLACE FUNCTION auth.catat_kirim_email(
  _kind          text,
  _email         text,
  _jendela_detik int,
  _maks          int,
  _tangga        int[]
)
RETURNS TABLE (diizinkan boolean, sisa_detik int, terpakai int, maks int)
LANGUAGE plpgsql
AS $$
DECLARE
  _arr        timestamptz[];
  _batas      timestamptz := now() - make_interval(secs => _jendela_detik);
  _n          int;
  _boleh_pada timestamptz;
BEGIN
  -- Baris disiapkan lebih dulu supaya FOR UPDATE punya sesuatu untuk dikunci.
  INSERT INTO auth.email_throttle (kind, email)
  VALUES (_kind, _email)
  ON CONFLICT (kind, email) DO NOTHING;

  SELECT t.attempts INTO _arr
    FROM auth.email_throttle t
   WHERE t.kind = _kind AND t.email = _email
     FOR UPDATE;

  -- Buang percobaan yang sudah keluar dari jendela geser.
  SELECT COALESCE(array_agg(a ORDER BY a), '{}'::timestamptz[]) INTO _arr
    FROM unnest(COALESCE(_arr, '{}'::timestamptz[])) a
   WHERE a > _batas;

  _n := COALESCE(array_length(_arr, 1), 0);

  IF _n = 0 THEN
    _boleh_pada := now();
  ELSIF _n >= _maks THEN
    -- Kuota jendela habis. Boleh lagi saat percobaan TERTUA keluar jendela,
    -- bukan saat cooldown terakhir habis — kalau tidak, kuota per jam bisa
    -- ditembus dengan menunggu cooldown saja.
    _boleh_pada := _arr[1] + make_interval(secs => _jendela_detik);
  ELSE
    _boleh_pada := _arr[_n] + make_interval(secs => _tangga[LEAST(_n, array_length(_tangga, 1))]);
  END IF;

  IF now() < _boleh_pada OR _n >= _maks THEN
    -- Ditolak. Array hasil pemangkasan tetap ditulis supaya baris tidak
    -- menyimpan cap waktu basi selamanya.
    UPDATE auth.email_throttle t
       SET attempts = _arr, updated_at = now()
     WHERE t.kind = _kind AND t.email = _email;

    RETURN QUERY SELECT
      false,
      GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_boleh_pada - now()))))::int,
      _n,
      _maks;
    RETURN;
  END IF;

  _arr := _arr || now();
  UPDATE auth.email_throttle t
     SET attempts = _arr, updated_at = now()
   WHERE t.kind = _kind AND t.email = _email;

  -- Baris basi dibuang di sini, bukan lewat cron: tabelnya hanya sebesar jumlah
  -- alamat email yang pernah meminta kiriman, dan pembersihan ini menumpang
  -- pada permintaan yang memang sudah menulis. Menambah cron untuk tabel
  -- sekecil ini menambah bagian yang bisa lupa dipasang di server berikutnya.
  DELETE FROM auth.email_throttle t WHERE t.updated_at < now() - interval '2 days';

  RETURN QUERY SELECT true, 0, COALESCE(array_length(_arr, 1), 0), _maks;
END;
$$;

/*
 * Membaca status tanpa mencatat percobaan, untuk menampilkan sisa cooldown saat
 * halaman dibuka. Sengaja tidak mengunci apa pun: hasilnya hanya untuk tampilan,
 * dan penegakannya tetap di catat_kirim_email.
 */
CREATE OR REPLACE FUNCTION auth.status_kirim_email(
  _kind          text,
  _email         text,
  _jendela_detik int,
  _maks          int,
  _tangga        int[]
)
RETURNS TABLE (sisa_detik int, terpakai int, maks int)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  _arr        timestamptz[];
  _n          int;
  _boleh_pada timestamptz;
BEGIN
  SELECT COALESCE(array_agg(a ORDER BY a), '{}'::timestamptz[]) INTO _arr
    FROM auth.email_throttle t, unnest(t.attempts) a
   WHERE t.kind = _kind AND t.email = _email
     AND a > now() - make_interval(secs => _jendela_detik);

  _n := COALESCE(array_length(_arr, 1), 0);

  IF _n = 0 THEN
    RETURN QUERY SELECT 0, 0, _maks;
    RETURN;
  ELSIF _n >= _maks THEN
    _boleh_pada := _arr[1] + make_interval(secs => _jendela_detik);
  ELSE
    _boleh_pada := _arr[_n] + make_interval(secs => _tangga[LEAST(_n, array_length(_tangga, 1))]);
  END IF;

  RETURN QUERY SELECT
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_boleh_pada - now()))))::int,
    _n,
    _maks;
END;
$$;

ALTER TABLE auth.email_throttle OWNER TO inipilihanku;
ALTER FUNCTION auth.catat_kirim_email(text, text, int, int, int[]) OWNER TO inipilihanku;
ALTER FUNCTION auth.status_kirim_email(text, text, int, int, int[]) OWNER TO inipilihanku;

-- Peran RLS tidak diberi akses apa pun. Tabel ini hanya disentuh lewat klien
-- service di jalur autentikasi; tidak ada permintaan pengguna yang perlu
-- membacanya langsung.
REVOKE ALL ON auth.email_throttle FROM inipilihanku_app;
