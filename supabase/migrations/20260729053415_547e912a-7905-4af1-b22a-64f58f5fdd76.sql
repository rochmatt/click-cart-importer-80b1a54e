ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS customer_email text NOT NULL DEFAULT '';

UPDATE public.orders SET customer_email = 'ayu.pratiwi@example.com' WHERE order_number = 'INV/2026/07/2841';
UPDATE public.orders SET customer_email = 'budi.santoso@example.com' WHERE order_number = 'INV/2026/07/2799';
UPDATE public.orders SET customer_email = 'citra.dewi@example.com' WHERE order_number = 'INV/2026/07/2650';
UPDATE public.orders SET customer_email = 'dimas.arifin@example.com' WHERE order_number = 'INV/2026/07/2912';
UPDATE public.orders SET customer_email = 'eka.putri@example.com' WHERE order_number = 'INV/2026/07/2930';
UPDATE public.orders SET customer_email = 'shopper@example.com' WHERE customer_email = '';

DROP POLICY IF EXISTS "Anyone can look up orders by number" ON public.orders;
REVOKE SELECT ON public.orders FROM anon;
REVOKE SELECT ON public.orders FROM authenticated;
GRANT ALL ON public.orders TO service_role;