-- Audit log aksi admin, dan log pengiriman email.
--
-- KEDUANYA HANYA-TAMBAH. Tidak ada policy UPDATE maupun DELETE — bukan karena
-- lupa, tapi karena itulah yang membedakan audit log dari tabel biasa. Catatan
-- yang bisa disunting oleh orang yang diawasinya tidak membuktikan apa pun.
-- Klien service memang melewati RLS, tapi kode aplikasi tidak pernah menulis
-- UPDATE ke tabel ini, dan ketiadaan policy membuat siapa pun yang menyambung
-- lewat jalur biasa tidak bisa melakukannya.
--
-- Idempoten: aman dijalankan ulang.

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  -- Identitas pelaku disimpan RANGKAP: id untuk menyambung ke pengguna, email
  -- sebagai teks apa adanya. Kalau akun admin dihapus, ON DELETE SET NULL
  -- membuang id-nya, tapi catatan tetap menyebut siapa yang bertindak. Audit log
  -- yang berubah jadi "pengguna terhapus melakukan sesuatu" tidak ada gunanya.
  actor_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_email   text NOT NULL,

  entity        text NOT NULL CHECK (entity IN ('produk', 'pesanan', 'kategori', 'pengaturan', 'pengguna', 'pengumuman')),
  entity_id     text,
  entity_label  text NOT NULL DEFAULT '',

  action        text NOT NULL CHECK (action IN ('tambah', 'ubah', 'ubah_status', 'hapus', 'pulihkan')),
  detail        text NOT NULL DEFAULT '',

  -- Nilai sebelum dan sesudah untuk perubahan yang perlu ditelusuri. jsonb, bukan
  -- kolom terpisah, karena bentuknya berbeda tiap entitas.
  meta          jsonb
);

-- Halaman audit selalu mengurut terbaru dulu dan hampir selalu menyaring salah
-- satu dari ketiganya.
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx  ON public.audit_logs (entity, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx  ON public.audit_logs (action, created_at DESC);

CREATE TABLE IF NOT EXISTS public.email_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),

  recipient     text NOT NULL,
  subject       text NOT NULL,
  kind          text NOT NULL DEFAULT 'lain',
  order_number  text,

  -- 'terkirim' berarti Resend menerimanya, BUKAN berarti sampai di kotak masuk.
  -- Perbedaan itu penting saat menelusuri keluhan "email tidak masuk": status
  -- terkirim memindahkan kecurigaan ke spam filter atau alamat yang salah.
  status        text NOT NULL CHECK (status IN ('terkirim', 'gagal')),
  provider_id   text,
  error_message text
);

CREATE INDEX IF NOT EXISTS email_logs_created_idx ON public.email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_status_idx  ON public.email_logs (status, created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_read ON public.audit_logs;
DROP POLICY IF EXISTS email_read ON public.email_logs;

-- Hanya SELECT, hanya admin. Tidak ada policy tulis sama sekali.
CREATE POLICY audit_read ON public.audit_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY email_read ON public.email_logs FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Kepemilikan disamakan dengan tabel lain. Kalau dijalankan sebagai postgres,
-- tanpa baris ini tabelnya dimiliki postgres dan aplikasi kehilangan akses —
-- halamannya tetap terbuka tapi setiap query menjawab "permission denied".
ALTER TABLE public.audit_logs OWNER TO inipilihanku;
ALTER TABLE public.email_logs OWNER TO inipilihanku;

-- Peran RLS hanya boleh MEMBACA. Penulisan berjalan lewat peran pemilik yang
-- dipakai klien service. Ini melapisi ketiadaan policy INSERT/UPDATE/DELETE:
-- policy bisa terhapus tanpa sengaja oleh migrasi berikutnya, hak akses tidak.
GRANT SELECT ON public.audit_logs, public.email_logs TO inipilihanku_app;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs, public.email_logs FROM inipilihanku_app;
