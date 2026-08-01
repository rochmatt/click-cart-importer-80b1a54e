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