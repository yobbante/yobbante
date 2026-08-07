ALTER TABLE public.dekk_orders
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS payment_external_id text,
  ADD COLUMN IF NOT EXISTS payment_provider_ref text;

CREATE INDEX IF NOT EXISTS dekk_orders_payment_external_id_idx ON public.dekk_orders (payment_external_id);