CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'info',
  link_url text NOT NULL DEFAULT '',
  link_label text NOT NULL DEFAULT '',
  show_as_banner boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  starts_at timestamp with time zone NOT NULL DEFAULT now(),
  ends_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.announcements TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active announcements"
ON public.announcements FOR SELECT TO anon, authenticated
USING (is_active = true AND starts_at <= now() AND (ends_at IS NULL OR ends_at > now()));

CREATE POLICY "Admins can read all announcements"
ON public.announcements FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can create announcements"
ON public.announcements FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update announcements"
ON public.announcements FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete announcements"
ON public.announcements FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_announcements_updated_at
BEFORE UPDATE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.announcements (title, message, kind, link_url, link_label, show_as_banner, priority, is_active) VALUES
('Voucher pengguna baru Rp100.000', 'Klaim voucher pengguna baru sekarang, berlaku untuk semua kategori.', 'promo', '/search', 'Klaim sekarang', true, 30, true),
('Gratis ongkir seluruh Indonesia', 'Tanpa minimum belanja untuk pengiriman reguler minggu ini.', 'info', '/', 'Lihat produk', true, 20, true),
('Waspada penipuan mengaku admin', 'Kami tidak pernah meminta kode OTP atau transfer ke rekening pribadi.', 'warning', '', '', true, 10, true),
('Pemeliharaan sistem pembayaran', 'Pembayaran kartu kredit akan terganggu Sabtu 02.00-04.00 WIB.', 'maintenance', '', '', false, 5, true);