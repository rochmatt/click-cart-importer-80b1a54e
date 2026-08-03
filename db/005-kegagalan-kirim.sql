-- Penanganan kegagalan dari layanan email pada riwayat percobaan.
--
-- MASALAH YANG DIPERBAIKI. Saat Resend menjawab 429 atau 5xx, pengiriman
-- melempar. Lemparan itu melewati pencatatan, sehingga percobaan yang SUDAH
-- memakan kuota pengguna tidak meninggalkan jejak sama sekali — justru kasus
-- yang paling perlu dilihat saat menyelidiki keluhan "emailnya tidak sampai".
--
-- Dan karena kuotanya terlanjur terpakai, gangguan di pihak Resend menghanguskan
-- jatah pengguna yang tidak melakukan kesalahan apa pun.
--
-- Idempoten: aman dijalankan ulang.

-- Kolom terpisah, bukan nilai baru pada outcome. outcome menyatakan keputusan
-- PEMBATAS; kegagalan layanan email terjadi setelah pembatas mengizinkan.
-- Menggabungkannya akan membuat "diizinkan" berhenti berarti "diizinkan".
ALTER TABLE public.resend_attempts
  ADD COLUMN IF NOT EXISTS error_kirim text;

COMMENT ON COLUMN public.resend_attempts.error_kirim IS
  'Pesan galat dari layanan email. NULL saat tidak ada galat — termasuk saat email memang tidak perlu dikirim karena akunnya tidak ada.';

CREATE OR REPLACE FUNCTION public.catat_percobaan_kirim(
  _kind          text,
  _email         text,
  _outcome       text,
  _email_dikirim boolean,
  _sisa_detik    int,
  _terpakai      int,
  _ip            text,
  _error_kirim   text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.resend_attempts
    (kind, email, outcome, email_dikirim, sisa_detik, terpakai, ip, error_kirim)
  VALUES
    (_kind, _email, _outcome, _email_dikirim, _sisa_detik, _terpakai, _ip, left(_error_kirim, 500));

  DELETE FROM public.resend_attempts WHERE created_at < now() - interval '30 days';
END;
$$;

/*
 * Mengembalikan satu jatah yang terlanjur terpakai.
 *
 * Dipakai HANYA ketika layanan email gagal dengan galat yang layak dicoba ulang
 * (429 dan 5xx). Pengguna tidak melakukan kesalahan apa pun; menghukumnya
 * dengan cooldown karena penyedia email sedang bermasalah membuat gangguan
 * pihak ketiga menjadi gangguan bagi pengguna kita.
 *
 * Galat permanen — alamat salah, domain belum terverifikasi — TIDAK dikembalikan.
 * Mencoba ulang tidak akan menolong, dan mengembalikan jatahnya hanya membuka
 * jalan untuk menembak berulang kali tanpa batas.
 *
 * Yang dibuang adalah cap waktu TERAKHIR. Aman dari salah sasaran karena begitu
 * satu percobaan tercatat, cooldown langsung aktif dan tidak ada percobaan lain
 * yang bisa menyisipkan cap waktu sebelum pembatalan ini dijalankan beberapa
 * milidetik kemudian.
 */
CREATE OR REPLACE FUNCTION auth.batalkan_kirim_email(_kind text, _email text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE auth.email_throttle t
     SET attempts = t.attempts[1:array_length(t.attempts, 1) - 1],
         updated_at = now()
   WHERE t.kind = _kind
     AND t.email = _email
     AND COALESCE(array_length(t.attempts, 1), 0) > 0;
END;
$$;

ALTER FUNCTION public.catat_percobaan_kirim(text, text, text, boolean, int, int, text, text)
  OWNER TO inipilihanku;
ALTER FUNCTION auth.batalkan_kirim_email(text, text) OWNER TO inipilihanku;

-- Versi lama tanpa parameter error_kirim dibuang supaya tidak ada dua fungsi
-- bernama sama dengan perilaku berbeda, yang membuat pemanggilan bergantung
-- pada resolusi tipe.
DROP FUNCTION IF EXISTS public.catat_percobaan_kirim(text, text, text, boolean, int, int, text);
