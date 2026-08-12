-- Audience targeting untuk pengumuman.
--
-- Tiap pengumuman menyasar satu kelompok penonton:
--   all       — semua pengunjung (perilaku lama; default)
--   guest     — hanya yang BELUM login (mis. promo daftar / first-order)
--   member    — hanya yang SUDAH login (mis. diskon member)
--   admin     — hanya penonton berperan admin (catatan internal)
--   moderator — hanya penonton berperan moderator
--
-- Penyaringan dilakukan SERVER di fetchAnnouncements berdasarkan sesi penonton
-- (lihat pengumumanUntukPenonton di src/lib/announcement-window.ts). Ini murni
-- penyaringan RELEVANSI di lapisan aplikasi, BUKAN batas keamanan: policy
-- announce_read tetap membuka baca publik (USING true). Aman karena browser
-- tidak lagi menembak tabel langsung — ia hanya menerima hasil terfilter dari
-- server function; jadi banner yang tak disasar tidak pernah sampai ke klien.

ALTER TABLE public.announcements
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'all';

-- Kunci nilainya ke daftar yang didukung. Idempoten: buang dulu kalau ada.
ALTER TABLE public.announcements
  DROP CONSTRAINT IF EXISTS announcements_audience_check;
ALTER TABLE public.announcements
  ADD CONSTRAINT announcements_audience_check
  CHECK (audience IN ('all', 'guest', 'member', 'admin', 'moderator'));
