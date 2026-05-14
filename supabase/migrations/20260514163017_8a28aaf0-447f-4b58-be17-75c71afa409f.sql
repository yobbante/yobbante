CREATE TABLE public.transporteur_inscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  prenom text NOT NULL,
  nom text NOT NULL,
  telephone text NOT NULL,
  ville text NOT NULL,
  types_transport text[] NOT NULL DEFAULT '{}',
  source text NOT NULL DEFAULT 'landing_home',
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.transporteur_inscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit transporteur inscription"
ON public.transporteur_inscriptions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(btrim(prenom)) BETWEEN 1 AND 80
  AND length(btrim(nom)) BETWEEN 1 AND 80
  AND length(btrim(telephone)) BETWEEN 6 AND 32
  AND length(btrim(ville)) BETWEEN 2 AND 80
  AND array_length(types_transport, 1) >= 1
);

CREATE POLICY "Staff view transporteur inscriptions"
ON public.transporteur_inscriptions
FOR SELECT
TO authenticated
USING (is_staff(auth.uid()));

CREATE POLICY "Staff update transporteur inscriptions"
ON public.transporteur_inscriptions
FOR UPDATE
TO authenticated
USING (is_staff(auth.uid()));

CREATE TRIGGER trg_transporteur_inscriptions_updated_at
BEFORE UPDATE ON public.transporteur_inscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();