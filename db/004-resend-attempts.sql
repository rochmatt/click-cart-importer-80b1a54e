-- Catatan setiap percobaan kirim ulang email verifikasi dan reset password.
--
-- KENAPA TABEL SENDIRI, bukan menumpang yang sudah ada:
--
--   email_logs  hanya terisi ketika email BENAR-BENAR dikirim ke Resend.
--               Percobaan yang ditolak pembatas tidak pernah sampai ke sana,
--               padahal justru penolakan itulah yang perlu ditinjau saat
--               menyelidiki penyalahgunaan.
--   audit_logs  mencatat aksi ADMIN, dengan actor_id menunjuk auth.users.
--               Percobaan kirim ulang dilakukan pengunjung yang bahkan belum
--               tentu punya akun, jadi tidak ada aktor yang bisa ditunjuk.
--   email_throttle  hanya menyimpan cap waktu percobaan yang DIIZINKAN, karena
--               tugasnya menghitung kuota — bukan menyimpan riwayat.
--
-- PERTIMBANGAN DATA PRIBADI. Tabel ini menyimpan alamat email siapa pun yang
-- pernah mengetiknya di formulir — termasuk yang tidak punya akun — beserta IP.
-- Itu kumpulan yang sensitif, dan alasan satu-satunya menyimpannya adalah
-- meninjau penyalahgunaan. Karena itu ada batas simpan 30 hari yang dijalankan
-- otomatis, bukan sekadar diniatkan.
--
-- Idempoten: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.resend_attempts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),

  kind        text NOT NULL CHECK (kind IN ('verifikasi', 'reset')),
  email       text NOT NULL,

  -- Keputusan PEMBATAS, bukan hasil pengiriman. Keduanya sengaja dipisah:
  -- 'diizinkan' berarti kuota mengizinkan, dan itu belum tentu berujung email
  -- karena akunnya bisa saja tidak ada atau sudah terverifikasi.
  outcome     text NOT NULL CHECK (outcome IN ('diizinkan', 'ditolak_cooldown', 'ditolak_kuota', 'ditolak_ip')),

  -- Apakah email sungguhan dikirim. Menjawab keluhan yang paling sering muncul,
  -- "saya minta kirim ulang tapi tidak ada email masuk", tanpa perlu menebak.
  email_dikirim boolean NOT NULL DEFAULT false,

  sisa_detik  int NOT NULL DEFAULT 0,
  terpakai    int NOT NULL DEFAULT 0,

  -- Nullable: di balik proxy yang tidak menyetel X-Forwarded-For, tidak ada IP
  -- yang bisa dipercaya. Menyimpan tebakan lebih buruk daripada mengosongkan.
  ip          text
);

CREATE INDEX IF NOT EXISTS resend_attempts_created_idx ON public.resend_attempts (created_at DESC);
CREATE INDEX IF NOT EXISTS resend_attempts_email_idx   ON public.resend_attempts (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS resend_attempts_outcome_idx ON public.resend_attempts (outcome, created_at DESC);

ALTER TABLE public.resend_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS resend_attempts_read ON public.resend_attempts;

-- Hanya SELECT, hanya admin. Tidak ada policy tulis: penulisan lewat peran
-- pemilik yang dipakai klien service, sama seperti audit_logs.
CREATE POLICY resend_attempts_read ON public.resend_attempts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.resend_attempts OWNER TO inipilihanku;

GRANT SELECT ON public.resend_attempts TO inipilihanku_app;
REVOKE INSERT, UPDATE, DELETE ON public.resend_attempts FROM inipilihanku_app;

/*
 * Menulis satu percobaan sekaligus membuang yang sudah lewat batas simpan.
 *
 * Pembuangan ditumpangkan pada penulisan, bukan lewat cron, dengan alasan yang
 * sama seperti auth.email_throttle: menambah cron untuk satu tabel menambah
 * bagian yang bisa lupa dipasang saat pindah server, sedangkan penulisan ke
 * tabel ini sudah pasti terjadi selama fiturnya dipakai.
 *
 * Konsekuensinya jujur: kalau tidak ada seorang pun meminta kirim ulang selama
 * berbulan-bulan, baris lama ikut menganggur lebih lama dari 30 hari. Tabelnya
 * kecil, dan jumlah barisnya berhenti bertambah justru karena tidak dipakai.
 */
CREATE OR REPLACE FUNCTION public.catat_percobaan_kirim(
  _kind          text,
  _email         text,
  _outcome       text,
  _email_dikirim boolean,
  _sisa_detik    int,
  _terpakai      int,
  _ip            text
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.resend_attempts (kind, email, outcome, email_dikirim, sisa_detik, terpakai, ip)
  VALUES (_kind, _email, _outcome, _email_dikirim, _sisa_detik, _terpakai, _ip);

  DELETE FROM public.resend_attempts WHERE created_at < now() - interval '30 days';
END;
$$;

ALTER FUNCTION public.catat_percobaan_kirim(text, text, text, boolean, int, int, text)
  OWNER TO inipilihanku;
