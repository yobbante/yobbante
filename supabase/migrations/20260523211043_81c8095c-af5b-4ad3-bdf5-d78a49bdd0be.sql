CREATE TABLE public.custom_cities (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  city text NOT NULL,
  country_code text NOT NULL,
  country_label text NOT NULL,
  flag text NOT NULL DEFAULT '🏳️',
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country_code, city)
);

ALTER TABLE public.custom_cities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active custom cities"
  ON public.custom_cities FOR SELECT
  TO anon, authenticated
  USING (active = true OR is_staff(auth.uid()));

CREATE POLICY "Staff manage custom cities"
  ON public.custom_cities FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER update_custom_cities_updated_at
  BEFORE UPDATE ON public.custom_cities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();