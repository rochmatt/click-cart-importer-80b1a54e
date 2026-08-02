-- Skema PostgreSQL lokal untuk inipilihanku.com — pengganti Supabase.
--
-- Dijalankan sebagai pemilik database (role: inipilihanku):
--   psql "postgresql://inipilihanku:PASSWORD@127.0.0.1:5432/inipilihanku" -f db/schema.sql
--
-- Idempoten: aman dijalankan berulang.
--
-- KEPUTUSAN DESAIN
--
-- 1. Schema `auth` dipertahankan beserta fungsi auth.uid(). Supabase menegakkan
--    keamanan lewat RLS yang memanggil auth.uid(); dengan menyediakan fungsi
--    bernama sama, ke-12 policy yang sudah ada pindah nyaris tanpa perubahan
--    dan RLS tetap menjadi lapisan pertahanan di dalam database — bukan hanya
--    di kode aplikasi.
--
-- 2. auth.uid() membaca session variable `app.user_id`, bukan JWT. Lapisan data
--    aplikasi wajib menjalankan SET LOCAL app.user_id = '<uuid>' di awal setiap
--    transaksi milik pengguna. Kalau lupa, auth.uid() bernilai NULL dan policy
--    menolak akses — gagal ke arah aman, bukan membuka data.
--
-- 3. Dua role koneksi, meniru pemisahan Supabase:
--      inipilihanku      -> pemilik tabel, MELEWATI RLS. Untuk operasi service
--                           (setara service_role). Dipakai dari server saja.
--      inipilihanku_app  -> TUNDUK pada RLS. Untuk query atas nama pengguna.
--
-- 4. Migrasi 20260801160428 (publication supabase_realtime) sengaja dilewati —
--    khusus Realtime Supabase, tidak ada padanannya di PostgreSQL polos.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;  -- gen_random_uuid()

CREATE SCHEMA IF NOT EXISTS auth;

-- ---------------------------------------------------------------------------
-- Identitas pengguna (pengganti auth.users milik Supabase)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text NOT NULL,
  encrypted_password  text,
  email_confirmed_at  timestamptz,
  last_sign_in_at     timestamptz,
  raw_user_meta_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_anonymous        boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Email dibandingkan case-insensitive; unique index di lower(email) menutup
-- celah pendaftaran ganda "Budi@x.com" vs "budi@x.com".
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_key ON auth.users (lower(email));

-- Token verifikasi email / reset password / ganti email. Disimpan sebagai hash
-- supaya bocornya isi tabel tidak langsung bisa dipakai membajak akun.
CREATE TABLE IF NOT EXISTS auth.tokens (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('signup','recovery','email_change','magiclink','reauthentication')),
  token_hash  text NOT NULL,
  new_email   text,
  expires_at  timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tokens_user_id_idx ON auth.tokens (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS tokens_hash_key ON auth.tokens (token_hash);

CREATE TABLE IF NOT EXISTS auth.sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash  text NOT NULL,
  user_agent  text NOT NULL DEFAULT '',
  ip          text NOT NULL DEFAULT '',
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sessions_token_key ON auth.sessions (token_hash);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON auth.sessions (user_id);

/**
 * Pengganti auth.uid() Supabase.
 *
 * Nilai diambil dari session variable, bukan JWT. Parameter kedua `true` pada
 * current_setting berarti "kembalikan NULL kalau belum diset" — tanpa itu
 * PostgreSQL melempar error dan seluruh query gagal, bukan sekadar ditolak.
 */
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE
AS $$
  SELECT NULLIF(current_setting('app.user_id', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Fungsi bantu
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Tabel aplikasi
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL DEFAULT '',
  phone        text NOT NULL DEFAULT '',
  avatar_url   text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  -- Ditambahkan migrasi 20260802110830 yang belum pernah diterapkan di Supabase.
  preferences  jsonb NOT NULL DEFAULT '{"language":"id","currency":"IDR","email_promos":true,"email_order_updates":true,"email_price_drop":false,"whatsapp_updates":false}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE IF NOT EXISTS public.admin_products (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title             text NOT NULL DEFAULT '',
  category          text NOT NULL DEFAULT 'Fashion',
  description       text NOT NULL DEFAULT '',
  images            text[] NOT NULL DEFAULT '{}',
  price             bigint NOT NULL DEFAULT 0,
  sale_price        bigint,
  status            text NOT NULL DEFAULT 'draft',
  stock             integer NOT NULL DEFAULT 0,
  variations        jsonb NOT NULL DEFAULT '[]'::jsonb,
  links             jsonb NOT NULL DEFAULT '{"shopee": "", "tiktok": "", "tokopedia": ""}'::jsonb,
  weight            text NOT NULL DEFAULT '',
  dimensions        text NOT NULL DEFAULT '',
  seo_title         text NOT NULL DEFAULT '',
  seo_description   text NOT NULL DEFAULT '',
  catalog_ref       text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  brand             text NOT NULL DEFAULT '',
  size_options      text[] NOT NULL DEFAULT '{}',
  warranty_status   text NOT NULL DEFAULT 'none',
  warranty_duration text NOT NULL DEFAULT '',
  custom_attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rating            numeric NOT NULL DEFAULT 4.7,
  reviews           integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.orders (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number          text NOT NULL,
  product_name          text NOT NULL,
  quantity              integer NOT NULL DEFAULT 1,
  status                text NOT NULL DEFAULT 'processing',
  courier               text,
  tracking_number       text,
  destination_city      text,
  eta_date              date,
  last_update           text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  customer_email        text NOT NULL DEFAULT '',
  notify_status_updates boolean NOT NULL DEFAULT true,
  notify_updated_at     timestamptz,
  notify_level          text NOT NULL DEFAULT 'all',
  user_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  subtotal              bigint NOT NULL DEFAULT 0,
  discount              bigint NOT NULL DEFAULT 0,
  shipping_fee          bigint NOT NULL DEFAULT 0,
  total                 bigint NOT NULL DEFAULT 0,
  promo_code            text NOT NULL DEFAULT '',
  payment_method        text NOT NULL DEFAULT 'cod',
  shipping_name         text NOT NULL DEFAULT '',
  shipping_phone        text NOT NULL DEFAULT '',
  shipping_address      text NOT NULL DEFAULT '',
  shipping_postal_code  text NOT NULL DEFAULT '',
  notes                 text NOT NULL DEFAULT '',
  notified_status       text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);

CREATE TABLE IF NOT EXISTS public.order_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_ref text NOT NULL,
  title       text NOT NULL,
  image       text NOT NULL DEFAULT '',
  unit_price  bigint NOT NULL DEFAULT 0,
  quantity    integer NOT NULL DEFAULT 1,
  line_total  bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_ref text NOT NULL,
  title       text NOT NULL DEFAULT '',
  image       text NOT NULL DEFAULT '',
  price       text NOT NULL DEFAULT '',
  qty         integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cart_items_user_id_idx ON public.cart_items (user_id);

CREATE TABLE IF NOT EXISTS public.wishlist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_ref text NOT NULL,
  title       text NOT NULL DEFAULT '',
  image       text NOT NULL DEFAULT '',
  price       text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wishlist_items_user_id_idx ON public.wishlist_items (user_id);

CREATE TABLE IF NOT EXISTS public.sales_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date  date NOT NULL,
  marketplace text NOT NULL,
  product_ref text NOT NULL,
  views       integer NOT NULL DEFAULT 0,
  clicks      integer NOT NULL DEFAULT 0,
  orders      integer NOT NULL DEFAULT 0,
  revenue     bigint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sales_events_event_date_idx ON public.sales_events (event_date);

-- Empat tabel di bawah ada di migrasi 1 Agustus yang TIDAK PERNAH diterapkan
-- di Supabase, sehingga 19 pemanggilan di kode menunjuk tabel yang tidak ada.
-- Dibuat di sini sekaligus memperbaiki fitur-fitur itu.

CREATE TABLE IF NOT EXISTS public.user_addresses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label          text NOT NULL DEFAULT 'Home',
  recipient_name text NOT NULL DEFAULT '',
  phone          text NOT NULL DEFAULT '',
  address_line   text NOT NULL DEFAULT '',
  city           text NOT NULL DEFAULT '',
  province       text NOT NULL DEFAULT '',
  postal_code    text NOT NULL DEFAULT '',
  notes          text NOT NULL DEFAULT '',
  is_default     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_addresses_user_id_idx ON public.user_addresses (user_id);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name              text NOT NULL DEFAULT 'PasarPilih',
  tagline                 text NOT NULL DEFAULT '',
  support_email           text NOT NULL DEFAULT '',
  support_phone           text NOT NULL DEFAULT '',
  store_address           text NOT NULL DEFAULT '',
  logo_url                text NOT NULL DEFAULT '',
  shopee_link_template    text NOT NULL DEFAULT '',
  tokopedia_link_template text NOT NULL DEFAULT '',
  tiktok_link_template    text NOT NULL DEFAULT '',
  utm_source              text NOT NULL DEFAULT 'pasarpilih',
  utm_medium              text NOT NULL DEFAULT 'referral',
  utm_campaign            text NOT NULL DEFAULT '',
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.announcements (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title          text NOT NULL DEFAULT '',
  message        text NOT NULL DEFAULT '',
  kind           text NOT NULL DEFAULT 'info',
  link_url       text NOT NULL DEFAULT '',
  link_label     text NOT NULL DEFAULT '',
  show_as_banner boolean NOT NULL DEFAULT false,
  priority       integer NOT NULL DEFAULT 0,
  is_active      boolean NOT NULL DEFAULT true,
  starts_at      timestamptz NOT NULL DEFAULT now(),
  ends_at        timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','admin_products','orders','cart_items',
    'user_addresses','store_settings','announcements'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%1$s_updated_at ON public.%1$I', t);
    EXECUTE format(
      'CREATE TRIGGER update_%1$s_updated_at BEFORE UPDATE ON public.%1$I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Otorisasi
-- ---------------------------------------------------------------------------

/**
 * SECURITY DEFINER supaya pengguna biasa bisa memeriksa perannya sendiri tanpa
 * diberi hak SELECT langsung ke user_roles. search_path dikunci ke public agar
 * pemanggil tidak bisa membajaknya lewat schema bayangan.
 */
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT schemaname, tablename, policyname FROM pg_policies WHERE schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- Katalog & konten publik: siapa pun boleh baca, hanya admin boleh menulis.
CREATE POLICY products_read   ON public.admin_products FOR SELECT USING (true);
CREATE POLICY products_write  ON public.admin_products FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY settings_read   ON public.store_settings FOR SELECT USING (true);
CREATE POLICY settings_write  ON public.store_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY announce_read   ON public.announcements FOR SELECT USING (true);
CREATE POLICY announce_write  ON public.announcements FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY sales_read      ON public.sales_events FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

-- Data milik pengguna: hanya pemiliknya, atau admin.
CREATE POLICY profiles_own    ON public.profiles FOR ALL
  USING (auth.uid() = id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = id);

CREATE POLICY roles_read      ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY roles_admin     ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY cart_own        ON public.cart_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY wishlist_own    ON public.wishlist_items FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY addresses_own   ON public.user_addresses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY orders_own      ON public.orders FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY orders_admin    ON public.orders FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY order_items_own ON public.order_items FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND (o.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ));

-- ---------------------------------------------------------------------------
-- Hak akses role koneksi
-- ---------------------------------------------------------------------------

-- Role inipilihanku_app dibuat sekali sebagai superuser, bukan di sini —
-- pemilik database tidak punya atribut CREATEROLE:
--
--   sudo -u postgres psql -d inipilihanku -c \
--     "CREATE ROLE inipilihanku_app WITH LOGIN PASSWORD '...';"

GRANT USAGE ON SCHEMA public, auth TO inipilihanku_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO inipilihanku_app;
GRANT EXECUTE ON FUNCTION auth.uid(), public.has_role(uuid, public.app_role) TO inipilihanku_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO inipilihanku_app;

-- Tabel auth HANYA boleh disentuh role pemilik. Password hash dan token tidak
-- pernah terjangkau koneksi yang melayani permintaan pengguna.
REVOKE ALL ON ALL TABLES IN SCHEMA auth FROM inipilihanku_app;

COMMIT;
