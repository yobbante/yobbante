ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS is_beta_validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beta_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_rejected_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_rejected_reason text;

CREATE INDEX IF NOT EXISTS idx_transporteurs_beta_pending
  ON public.transporteurs (created_at DESC)
  WHERE konnekt_registered = true AND is_beta_validated = false AND beta_rejected_at IS NULL;