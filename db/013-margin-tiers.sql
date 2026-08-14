-- Margin bertingkat dropship: berdasarkan MODAL (harga beli), margin NOMINAL tetap
-- (Rp) per rentang. Disimpan sebagai array JSON di store_settings; diisi manual
-- oleh admin di Settings. Harga jual saran = modal + margin tingkatnya.
-- Bentuk tiap elemen: { "id": text, "maxModal": number|null, "marginRp": number }.
ALTER TABLE public.store_settings
  ADD COLUMN IF NOT EXISTS margin_tiers jsonb NOT NULL DEFAULT '[]'::jsonb;
