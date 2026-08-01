-- 1. Customer address book
CREATE TABLE public.user_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  label text NOT NULL DEFAULT 'Home',
  recipient_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  address_line text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  province text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_addresses TO authenticated;
GRANT ALL ON public.user_addresses TO service_role;

ALTER TABLE public.user_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own addresses"
ON public.user_addresses FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX user_addresses_user_id_idx ON public.user_addresses (user_id);

CREATE TRIGGER update_user_addresses_updated_at
BEFORE UPDATE ON public.user_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Store settings (single row, admin editable)
CREATE TABLE public.store_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_name text NOT NULL DEFAULT 'PasarPilih',
  tagline text NOT NULL DEFAULT '',
  support_email text NOT NULL DEFAULT '',
  support_phone text NOT NULL DEFAULT '',
  store_address text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  shopee_link_template text NOT NULL DEFAULT '',
  tokopedia_link_template text NOT NULL DEFAULT '',
  tiktok_link_template text NOT NULL DEFAULT '',
  utm_source text NOT NULL DEFAULT 'pasarpilih',
  utm_medium text NOT NULL DEFAULT 'referral',
  utm_campaign text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.store_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.store_settings TO authenticated;
GRANT ALL ON public.store_settings TO service_role;

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read store settings"
ON public.store_settings FOR SELECT USING (true);

CREATE POLICY "Admins can insert store settings"
ON public.store_settings FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update store settings"
ON public.store_settings FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_store_settings_updated_at
BEFORE UPDATE ON public.store_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.store_settings (store_name, tagline, support_email, support_phone, store_address, utm_campaign)
VALUES ('PasarPilih', 'Belanja pilihan terbaik dari marketplace favoritmu', 'support@pasarpilih.id', '+62 812 0000 0000', 'Jakarta, Indonesia', 'katalog');

-- 3. Admin access to orders
CREATE POLICY "Admins can view all orders"
ON public.orders FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update orders"
ON public.orders FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all order items"
ON public.order_items FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 4. Admin access to customer profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 5. Admin role management
CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can grant roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can revoke roles"
ON public.user_roles FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

GRANT INSERT, DELETE ON public.user_roles TO authenticated;