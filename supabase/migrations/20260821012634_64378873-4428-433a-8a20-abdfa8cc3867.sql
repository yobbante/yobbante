ALTER TABLE public.dossiers ADD COLUMN IF NOT EXISTS transport_mode text;
ALTER TABLE public.dossiers DROP CONSTRAINT IF EXISTS dossiers_transport_mode_check;
ALTER TABLE public.dossiers ADD CONSTRAINT dossiers_transport_mode_check CHECK (transport_mode IS NULL OR transport_mode IN ('gp','air','sea','road'));
CREATE INDEX IF NOT EXISTS idx_dossiers_transport_mode ON public.dossiers (transport_mode);
UPDATE public.dossiers SET transport_mode = 'gp' WHERE transport_mode IS NULL AND (assigned_transporteur_ref IS NOT NULL OR assigned_departure_id IS NOT NULL);