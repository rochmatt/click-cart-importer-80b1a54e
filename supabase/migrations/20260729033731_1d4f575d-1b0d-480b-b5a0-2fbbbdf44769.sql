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