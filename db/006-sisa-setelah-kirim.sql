-- Memperbaiki sisa_detik yang dikembalikan saat pengiriman DIIZINKAN.
--
-- BUG YANG DIPERBAIKI. catat_kirim_email mengembalikan sisa_detik = 0 pada
-- cabang "diizinkan", seolah tombolnya boleh dipakai lagi seketika. Padahal
-- cooldown langsung aktif begitu percobaan tercatat — percobaan berikutnya
-- ditolak dengan sisa 60 detik.
--
-- Akibatnya di layar: setelah berhasil kirim ulang, tombol kembali aktif tanpa
-- hitungan mundur, pengguna menekannya lagi, lalu baru diberi tahu harus
-- menunggu. Versi lama yang menyimpan cooldown di localStorage tidak begitu;
-- perilakunya hilang saat pindah ke server.
--
-- Ditemukan oleh uji ujung-ke-ujung, bukan dengan membaca kode: cabang itu
-- tampak benar sampai jedanya dibandingkan dengan tangga yang seharusnya.
--
-- Idempoten: aman dijalankan ulang.

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
  INSERT INTO auth.email_throttle (kind, email)
  VALUES (_kind, _email)
  ON CONFLICT (kind, email) DO NOTHING;

  SELECT t.attempts INTO _arr
    FROM auth.email_throttle t
   WHERE t.kind = _kind AND t.email = _email
     FOR UPDATE;

  SELECT COALESCE(array_agg(a ORDER BY a), '{}'::timestamptz[]) INTO _arr
    FROM unnest(COALESCE(_arr, '{}'::timestamptz[])) a
   WHERE a > _batas;

  _n := COALESCE(array_length(_arr, 1), 0);

  IF _n = 0 THEN
    _boleh_pada := now();
  ELSIF _n >= _maks THEN
    _boleh_pada := _arr[1] + make_interval(secs => _jendela_detik);
  ELSE
    _boleh_pada := _arr[_n] + make_interval(secs => _tangga[LEAST(_n, array_length(_tangga, 1))]);
  END IF;

  IF now() < _boleh_pada OR _n >= _maks THEN
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
  _n := COALESCE(array_length(_arr, 1), 0);

  UPDATE auth.email_throttle t
     SET attempts = _arr, updated_at = now()
   WHERE t.kind = _kind AND t.email = _email;

  DELETE FROM auth.email_throttle t WHERE t.updated_at < now() - interval '2 days';

  -- Jeda yang BERLAKU SEKARANG, bukan nol. Kalau kiriman ini menghabiskan kuota
  -- jendela, yang berlaku adalah tunggu sampai percobaan tertua keluar jendela
  -- — bukan tangga cooldown, yang justru lebih pendek dan akan membuat tombol
  -- menyala sebelum waktunya.
  IF _n >= _maks THEN
    _boleh_pada := _arr[1] + make_interval(secs => _jendela_detik);
  ELSE
    _boleh_pada := now() + make_interval(secs => _tangga[LEAST(_n, array_length(_tangga, 1))]);
  END IF;

  RETURN QUERY SELECT
    true,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (_boleh_pada - now()))))::int,
    _n,
    _maks;
END;
$$;

ALTER FUNCTION auth.catat_kirim_email(text, text, int, int, int[]) OWNER TO inipilihanku;
