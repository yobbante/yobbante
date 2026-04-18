ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS konnekt_order_id text,
  ADD COLUMN IF NOT EXISTS konnekt_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS app_source text NOT NULL DEFAULT 'yobbante';

CREATE INDEX IF NOT EXISTS idx_dossiers_konnekt_order_id ON public.dossiers(konnekt_order_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_app_source ON public.dossiers(app_source);