ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS payment_external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_dossiers_payment_external_id
  ON public.dossiers (payment_external_id);