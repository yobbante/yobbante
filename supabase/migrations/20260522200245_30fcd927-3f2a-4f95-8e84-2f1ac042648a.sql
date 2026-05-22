
-- 1) Statut COLLECTING (ne casse rien si déjà présent)
DO $$ BEGIN
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'COLLECTING' BEFORE 'COLLECTED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Table livreurs
CREATE TABLE IF NOT EXISTS public.livreurs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prenom TEXT NOT NULL,
  nom TEXT NOT NULL,
  telephone TEXT NOT NULL UNIQUE,
  zone_couverte TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  invitation_bot_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.livreurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage livreurs"
  ON public.livreurs
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_livreurs_updated_at
  BEFORE UPDATE ON public.livreurs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3) Sessions bot livreur
CREATE TABLE IF NOT EXISTS public.livreur_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  livreur_id UUID REFERENCES public.livreurs(id) ON DELETE SET NULL,
  pending_intent TEXT,
  pending_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.livreur_bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage livreur_bot_sessions"
  ON public.livreur_bot_sessions
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 4) Colonnes additionnelles sur dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS livreur_collecte_id UUID REFERENCES public.livreurs(id),
  ADD COLUMN IF NOT EXISTS livreur_livraison_id UUID REFERENCES public.livreurs(id),
  ADD COLUMN IF NOT EXISTS collecte_creneau TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collecte_confirmee_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS collecte_photos TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS poids_livreur NUMERIC,
  ADD COLUMN IF NOT EXISTS conformite_ok BOOLEAN,
  ADD COLUMN IF NOT EXISTS conformite_notes TEXT,
  ADD COLUMN IF NOT EXISTS dernier_km_carrier TEXT,
  ADD COLUMN IF NOT EXISTS dernier_km_prix NUMERIC,
  ADD COLUMN IF NOT EXISTS dernier_km_tracking TEXT,
  ADD COLUMN IF NOT EXISTS dernier_km_label_url TEXT,
  ADD COLUMN IF NOT EXISTS dernier_km_adresse TEXT;

CREATE INDEX IF NOT EXISTS idx_dossiers_livreur_collecte ON public.dossiers(livreur_collecte_id);
CREATE INDEX IF NOT EXISTS idx_dossiers_livreur_livraison ON public.dossiers(livreur_livraison_id);

-- 5) Bucket colis-photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('colis-photos', 'colis-photos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read colis photos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'colis-photos');

CREATE POLICY "Staff upload colis photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'colis-photos' AND public.is_staff(auth.uid()));

CREATE POLICY "Staff delete colis photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'colis-photos' AND public.is_staff(auth.uid()));
