-- 1. Extend orders for real checkout
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

CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key ON public.orders (order_number);
CREATE INDEX IF NOT EXISTS orders_user_id_idx ON public.orders (user_id);

GRANT SELECT ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

DROP POLICY IF EXISTS "Users can view their own orders" ON public.orders;
CREATE POLICY "Users can view their own orders"
  ON public.orders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. Order line items
CREATE TABLE IF NOT EXISTS public.order_items (
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

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

GRANT SELECT ON public.order_items TO authenticated;
GRANT ALL ON public.order_items TO service_role;

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view items of their own orders" ON public.order_items;
CREATE POLICY "Users can view items of their own orders"
  ON public.order_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id AND o.user_id = auth.uid()
  ));

-- 3. Server-synced cart
CREATE TABLE IF NOT EXISTS public.cart_items (
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

DROP POLICY IF EXISTS "Users manage their own cart" ON public.cart_items;
CREATE POLICY "Users manage their own cart"
  ON public.cart_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS cart_items_updated_at ON public.cart_items;
CREATE TRIGGER cart_items_updated_at
  BEFORE UPDATE ON public.cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Wishlist
CREATE TABLE IF NOT EXISTS public.wishlist_items (
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

DROP POLICY IF EXISTS "Users manage their own wishlist" ON public.wishlist_items;
CREATE POLICY "Users manage their own wishlist"
  ON public.wishlist_items FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Storefront-facing product fields
ALTER TABLE public.admin_products
  ADD COLUMN IF NOT EXISTS rating numeric(2,1) NOT NULL DEFAULT 4.7,
  ADD COLUMN IF NOT EXISTS reviews integer NOT NULL DEFAULT 0;