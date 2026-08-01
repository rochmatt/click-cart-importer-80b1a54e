ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS notify_level text NOT NULL DEFAULT 'all';
ALTER TABLE public.orders ADD CONSTRAINT orders_notify_level_check CHECK (notify_level IN ('all','shipped_only','none'));
UPDATE public.orders SET notify_level = CASE WHEN notify_status_updates THEN 'all' ELSE 'none' END;