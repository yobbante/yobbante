ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS adresse_collecte_dakar TEXT,
  ADD COLUMN IF NOT EXISTS adresses_remise JSONB NOT NULL DEFAULT '{}'::jsonb;