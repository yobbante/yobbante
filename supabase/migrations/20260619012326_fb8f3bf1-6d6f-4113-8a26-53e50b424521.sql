
CREATE TABLE IF NOT EXISTS public.product_forfaits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom TEXT NOT NULL,
  description TEXT,
  destination TEXT NOT NULL DEFAULT 'ALL',
  mode TEXT NOT NULL DEFAULT 'ALL',
  prix_fcfa INTEGER NOT NULL CHECK (prix_fcfa > 0),
  devise_originale TEXT NOT NULL DEFAULT 'XOF',
  prix_devise_originale NUMERIC,
  taux_conversion NUMERIC,
  multiplicateur NUMERIC,
  actif BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.product_forfaits TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.product_forfaits TO authenticated;
GRANT ALL ON public.product_forfaits TO service_role;

ALTER TABLE public.product_forfaits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read active forfaits"
  ON public.product_forfaits FOR SELECT
  USING (actif = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert forfaits"
  ON public.product_forfaits FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update forfaits"
  ON public.product_forfaits FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete forfaits"
  ON public.product_forfaits FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER product_forfaits_set_updated_at
  BEFORE UPDATE ON public.product_forfaits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_product_forfaits_active_lookup
  ON public.product_forfaits (actif, destination, mode);
