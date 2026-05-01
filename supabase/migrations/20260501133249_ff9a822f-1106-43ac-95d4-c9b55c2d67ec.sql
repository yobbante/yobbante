
-- 1) transporteurs table
CREATE TABLE public.transporteurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference varchar(4) NOT NULL UNIQUE,
  nom text NOT NULL,
  telephone_1 text NOT NULL,
  telephone_2 text,
  adresse_1 text NOT NULL,
  adresse_2 text,
  ville text NOT NULL,
  zone text,
  notes text,
  actif boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT transporteurs_reference_format CHECK (reference ~ '^[0-9]{4}$')
);

CREATE INDEX idx_transporteurs_actif ON public.transporteurs (actif);
CREATE INDEX idx_transporteurs_ville ON public.transporteurs (ville);

ALTER TABLE public.transporteurs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage transporteurs"
  ON public.transporteurs FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_transporteurs_updated_at
  BEFORE UPDATE ON public.transporteurs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2) manual_departures.transporteur_ref FK
ALTER TABLE public.manual_departures
  ADD COLUMN transporteur_ref varchar(4) REFERENCES public.transporteurs(reference) ON DELETE SET NULL;

CREATE INDEX idx_manual_departures_transporteur_ref ON public.manual_departures(transporteur_ref);
