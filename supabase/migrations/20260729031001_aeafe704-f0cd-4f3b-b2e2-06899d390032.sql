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

GRANT SELECT ON public.orders TO anon;
GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can look up orders by number"
  ON public.orders FOR SELECT
  USING (true);

INSERT INTO public.orders (order_number, product_name, quantity, status, courier, tracking_number, destination_city, eta_date, last_update) VALUES
  ('INV/2026/07/2841', 'Aurora Wireless Headphones', 1, 'in_transit', 'JNE Reguler', 'JNE884120557391', 'Jakarta Selatan', CURRENT_DATE + 1, 'Departed sorting center Bekasi Hub'),
  ('INV/2026/07/2799', 'Nimbus Everyday Backpack', 2, 'out_for_delivery', 'SiCepat BEST', 'SC0092331877', 'Bandung', CURRENT_DATE, 'Courier is delivering your parcel today'),
  ('INV/2026/07/2650', 'Lumen Smart Desk Lamp', 1, 'delivered', 'J&T Express', 'JT7712009845', 'Surabaya', CURRENT_DATE - 2, 'Delivered and received at front desk'),
  ('INV/2026/07/2912', 'Terra Ceramic Mug Set', 3, 'packed', 'AnterAja Regular', 'AA5567120098', 'Yogyakarta', CURRENT_DATE + 3, 'Seller has packed your order, awaiting pickup'),
  ('INV/2026/07/2930', 'Vela Minimal Watch', 1, 'processing', NULL, NULL, 'Medan', CURRENT_DATE + 4, 'Payment confirmed, seller is preparing your order');