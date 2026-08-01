ALTER TABLE public.admin_products
  ADD COLUMN IF NOT EXISTS brand text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS size_options text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS warranty_status text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS warranty_duration text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS custom_attributes jsonb NOT NULL DEFAULT '[]'::jsonb;