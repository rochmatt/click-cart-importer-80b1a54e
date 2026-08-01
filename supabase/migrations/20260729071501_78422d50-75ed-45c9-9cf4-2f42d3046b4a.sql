ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS notify_status_updates boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_updated_at timestamptz;