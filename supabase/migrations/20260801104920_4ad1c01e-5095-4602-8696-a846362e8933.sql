-- Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Lock down admin_products writes
DROP POLICY IF EXISTS "Anyone can create products" ON public.admin_products;
DROP POLICY IF EXISTS "Anyone can update products" ON public.admin_products;
DROP POLICY IF EXISTS "Anyone can delete products" ON public.admin_products;

CREATE POLICY "Admins can create products"
  ON public.admin_products FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update products"
  ON public.admin_products FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete products"
  ON public.admin_products FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

REVOKE INSERT, UPDATE, DELETE ON public.admin_products FROM anon;
GRANT SELECT ON public.admin_products TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_products TO authenticated;
GRANT ALL ON public.admin_products TO service_role;