CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'processing',
  courier TEXT,
  tracking_number TEXT,
  destination_city TEXT,
  eta_date DATE,
  last_update TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

INSERT INTO public.orders (order_number, product_name, quantity, status, courier, tracking_number, destination_city, eta_date, last_update) VALUES
  ('INV/2026/07/2841', 'Aurora Wireless Headphones', 1, 'in_transit', 'JNE Reguler', 'JNE884120557391', 'Jakarta Selatan', CURRENT_DATE + 1, 'Departed sorting center Bekasi Hub'),
  ('INV/2026/07/2799', 'Nimbus Everyday Backpack', 2, 'out_for_delivery', 'SiCepat BEST', 'SC0092331877', 'Bandung', CURRENT_DATE, 'Courier is delivering your parcel today'),
  ('INV/2026/07/2650', 'Lumen Smart Desk Lamp', 1, 'delivered', 'J&T Express', 'JT7712009845', 'Surabaya', CURRENT_DATE - 2, 'Delivered and received at front desk'),
  ('INV/2026/07/2912', 'Terra Ceramic Mug Set', 3, 'packed', 'AnterAja Regular', 'AA5567120098', 'Yogyakarta', CURRENT_DATE + 3, 'Seller has packed your order, awaiting pickup'),
  ('INV/2026/07/2930', 'Vela Minimal Watch', 1, 'processing', NULL, NULL, 'Medan', CURRENT_DATE + 4, 'Payment confirmed, seller is preparing your order');

CREATE TABLE public.admin_products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'Fashion',
  description text NOT NULL DEFAULT '',
  images text[] NOT NULL DEFAULT '{}',
  price bigint NOT NULL DEFAULT 0,
  sale_price bigint,
  status text NOT NULL DEFAULT 'draft',
  stock integer NOT NULL DEFAULT 0,
  variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  links jsonb NOT NULL DEFAULT '{"shopee":"","tokopedia":"","tiktok":""}'::jsonb,
  weight text NOT NULL DEFAULT '',
  dimensions text NOT NULL DEFAULT '',
  seo_title text NOT NULL DEFAULT '',
  seo_description text NOT NULL DEFAULT '',
  catalog_ref text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_products TO authenticated;
GRANT ALL ON public.admin_products TO service_role;

ALTER TABLE public.admin_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read products" ON public.admin_products FOR SELECT USING (true);
CREATE POLICY "Anyone can create products" ON public.admin_products FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update products" ON public.admin_products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Anyone can delete products" ON public.admin_products FOR DELETE USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_admin_products_updated_at
BEFORE UPDATE ON public.admin_products
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.admin_products (catalog_ref, title, category, description, price, sale_price, status, stock, variations, links, weight, dimensions, seo_title, seo_description) VALUES
('1', 'Classic Low-Top Leather Sneakers — Everyday Comfort Edition', 'Fashion', 'Versatile everyday sneakers built for all-day comfort. Features a premium faux-leather upper, breathable mesh lining, and a cushioned insole that keeps every step light.', 799000, 549000, 'active', 128, '[{"id":"v1a","name":"Color","options":"Black, White, Navy"},{"id":"v1b","name":"Size","options":"39, 40, 41, 42, 43"}]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '780 g', '32 × 22 × 12 cm', 'Classic Low-Top Leather Sneakers', 'Everyday leather sneakers with cushioned insole and breathable mesh lining.'),
('2', 'Studio Wireless Over-Ear Headphones with Active Noise Cancelling', 'Electronics', 'Immerse yourself in rich, detailed audio with hybrid active noise cancelling, plush memory-foam ear cushions, and up to 30 hours of wireless playback.', 1699000, 1249000, 'active', 42, '[]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '320 g', '20 × 18 × 8 cm', 'Studio Wireless ANC Headphones', 'Hybrid noise cancelling headphones with 30 hours of playback and USB-C charging.'),
('3', 'Handmade Stoneware Mug 350ml, Matte Glaze Finish', 'Home & Living', 'An artisan-made stoneware mug finished with a soft matte glaze. Microwave and dishwasher safe, it brings a warm, handcrafted feel to your morning routine.', 129000, NULL, 'active', 310, '[{"id":"v3a","name":"Color","options":"Sand, Charcoal, Olive"}]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '450 g', '14 × 11 × 11 cm', 'Handmade Stoneware Mug 350ml', 'Artisan stoneware mug with matte glaze, microwave and dishwasher safe.'),
('4', 'Hydrating Vitamin C Facial Serum 30ml', 'Beauty', 'A lightweight daily serum that brightens and hydrates with stabilised vitamin C and hyaluronic acid.', 189000, 149000, 'draft', 76, '[]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '120 g', '10 × 5 × 5 cm', 'Hydrating Vitamin C Serum 30ml', 'Brightening vitamin C serum with hyaluronic acid for daily hydration.'),
('5', 'Minimalist Canvas Backpack with Laptop Sleeve', 'Fashion', 'A clean, city-ready backpack with a padded 15" laptop sleeve, water-resistant canvas and hidden security pocket.', 459000, 399000, 'active', 18, '[{"id":"v5a","name":"Color","options":"Black, Khaki"}]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '900 g', '45 × 30 × 15 cm', 'Minimalist Canvas Backpack', 'Water-resistant canvas backpack with padded 15-inch laptop sleeve.'),
('6', 'Smart Fitness Tracker Band with Heart Rate Monitor', 'Sports', 'Track workouts, heart rate and sleep with a bright AMOLED display and up to 14 days of battery life.', 549000, 429000, 'active', 244, '[]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '85 g', '12 × 6 × 3 cm', 'Smart Fitness Tracker Band', 'Fitness band with heart rate, sleep tracking and 14-day battery life.'),
('7', 'Aromatic Soy Wax Candle, 200g Hand Poured', 'Home & Living', 'Hand-poured soy wax candle with a warm amber and cedar blend, burning cleanly for up to 40 hours.', 159000, NULL, 'active', 5, '[]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '300 g', '9 × 9 × 10 cm', 'Aromatic Soy Wax Candle 200g', 'Hand-poured soy candle with amber and cedar notes, 40-hour burn time.'),
('8', 'Mechanical Keyboard 75% Layout, Hot-Swappable Switches', 'Electronics', 'A compact 75% mechanical keyboard with hot-swappable switches, gasket mount and per-key RGB lighting.', 1299000, 1099000, 'draft', 63, '[{"id":"v8a","name":"Switch","options":"Red, Brown, Blue"}]'::jsonb, '{"shopee":"https://shopee.co.id","tokopedia":"https://www.tokopedia.com","tiktok":"https://www.tiktok.com/shop"}'::jsonb, '1100 g', '35 × 15 × 5 cm', 'Mechanical Keyboard 75% Hot-Swap', 'Compact 75% gasket-mount keyboard with hot-swappable switches and RGB.');

ALTER TABLE public.admin_products
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_options text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS warranty_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS warranty_duration text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_attributes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) NOT NULL DEFAULT 4.7,
  ADD COLUMN IF NOT EXISTS reviews integer NOT NULL DEFAULT 0;

CREATE TABLE public.sales_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  marketplace text NOT NULL,
  product_ref text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  clicks integer NOT NULL DEFAULT 0,
  orders integer NOT NULL DEFAULT 0,
  revenue bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.sales_events TO anon;
GRANT SELECT ON public.sales_events TO authenticated;
GRANT ALL ON public.sales_events TO service_role;

ALTER TABLE public.sales_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read sales analytics"
ON public.sales_events FOR SELECT
USING (true);

CREATE INDEX sales_events_date_idx ON public.sales_events (event_date);
CREATE INDEX sales_events_marketplace_idx ON public.sales_events (marketplace);

INSERT INTO public.sales_events (event_date, marketplace, product_ref, views, clicks, orders, revenue)
SELECT d, mk, ref, views, clicks, orders, orders * price
FROM (
  SELECT d, mk, ref, price, views, clicks,
         GREATEST(0, floor(clicks * cvr))::int AS orders
  FROM (
    SELECT d, mk, ref, price, cvr,
           views,
           GREATEST(1, floor(views * ctr))::int AS clicks
    FROM (
      SELECT d.d AS d, m.mk AS mk, p.ref AS ref, p.price AS price,
             floor(((abs(hashtext(d.d::text || m.mk || p.ref)) % 780) + 120) * m.w)::int AS views,
             (((abs(hashtext(p.ref || m.mk || d.d::text)) % 15) + 8)::numeric / 100) AS ctr,
             (((abs(hashtext(m.mk || d.d::text || p.ref)) % 13) + 5)::numeric / 100) AS cvr
      FROM (SELECT generate_series(current_date - 29, current_date, interval '1 day')::date AS d) d
      CROSS JOIN (VALUES ('shopee', 1.0), ('tokopedia', 0.8), ('tiktok', 0.6)) AS m(mk, w)
      CROSS JOIN (VALUES
        ('p1', 1299000), ('p2', 899000), ('p3', 749000), ('p4', 329000),
        ('p5', 1150000), ('p6', 259000), ('p7', 549000), ('p8', 469000)
      ) AS p(ref, price)
    ) s1
  ) s2
) s3;

ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';

UPDATE public.orders SET customer_email = 'ayu.pratiwi@example.com' WHERE order_number = 'INV/2026/07/2841';
UPDATE public.orders SET customer_email = 'budi.santoso@example.com' WHERE order_number = 'INV/2026/07/2799';
UPDATE public.orders SET customer_email = 'citra.dewi@example.com' WHERE order_number = 'INV/2026/07/2650';
UPDATE public.orders SET customer_email = 'dimas.arifin@example.com' WHERE order_number = 'INV/2026/07/2912';
UPDATE public.orders SET customer_email = 'eka.putri@example.com' WHERE order_number = 'INV/2026/07/2930';
UPDATE public.orders SET customer_email = 'shopper@example.com' WHERE customer_email = '';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notify_status_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS notify_level text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS notified_status text NOT NULL DEFAULT '';

ALTER TABLE public.orders ADD CONSTRAINT orders_notify_level_check CHECK (notify_level IN ('all','shipped_only','none'));

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  display_name text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  avatar_url text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS subtotal bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_fee bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS payment_method text NOT NULL DEFAULT 'cod',
  ADD COLUMN IF NOT EXISTS shipping_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_address text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shipping_postal_code text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);

GRANT SELECT ON public.orders TO authenticated;

CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_ref text NOT NULL,
  title text NOT NULL,
  image text NOT NULL DEFAULT '',
  unit_price bigint NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 1,
  line_total bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX order_items_order_id_idx ON public.order_items (order_id);

GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view items of their own orders"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  ));

CREATE TABLE public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_ref text NOT NULL,
  title text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  qty integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_ref)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cart_items TO authenticated;
GRANT ALL ON public.cart_items TO service_role;

ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own cart"
  ON public.cart_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.wishlist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_ref text NOT NULL,
  title text NOT NULL DEFAULT '',
  image text NOT NULL DEFAULT '',
  price text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_ref)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wishlist_items TO authenticated;
GRANT ALL ON public.wishlist_items TO service_role;

ALTER TABLE public.wishlist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own wishlist"
  ON public.wishlist_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);