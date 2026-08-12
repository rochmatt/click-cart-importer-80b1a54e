-- Data pengiriman WAJIB terisi pada setiap pesanan (nama, telepon, alamat, kota).
--
-- Tiga lapis validasi:
--   1. Klien  — checkout.tsx via buyerFieldsSchema.safeParse (pesan per-field).
--   2. Server — placeOrder via placeOrderSchema.parse (skema yang sama).
--   3. DB     — CHECK di bawah ini: backstop yang menjaga invarian meski ada
--               jalur tulis lain di masa depan (mis. INSERT manual/service-role)
--               yang melewati validasi zod.
--
-- Memakai `~ '[^[:space:]]'` (bukan length(btrim(...)) > 0): btrim satu-argumen
-- hanya membuang spasi ASCII, jadi nilai berisi tab/newline saja masih lolos.
-- Regex ini menolak string kosong DAN whitespace-only apa pun.
-- destination_city dijaga non-null + non-kosong. shipping_postal_code & notes
-- sengaja TETAP opsional.
--
-- Idempoten: buang dulu bila ada, lalu tambahkan (pola sama dengan db/009).

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shipping_name_not_blank;
ALTER TABLE public.orders ADD CONSTRAINT orders_shipping_name_not_blank
  CHECK (shipping_name ~ '[^[:space:]]');

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shipping_phone_not_blank;
ALTER TABLE public.orders ADD CONSTRAINT orders_shipping_phone_not_blank
  CHECK (shipping_phone ~ '[^[:space:]]');

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_shipping_address_not_blank;
ALTER TABLE public.orders ADD CONSTRAINT orders_shipping_address_not_blank
  CHECK (shipping_address ~ '[^[:space:]]');

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_destination_city_not_blank;
ALTER TABLE public.orders ADD CONSTRAINT orders_destination_city_not_blank
  CHECK (destination_city IS NOT NULL AND destination_city ~ '[^[:space:]]');
