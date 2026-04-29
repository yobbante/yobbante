-- Coverage zones for pickup availability per origin city
CREATE TYPE public.coverage_level AS ENUM ('direct', 'partner', 'none');

CREATE TABLE public.coverage_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country text NOT NULL,
  city text NOT NULL,
  coverage_level public.coverage_level NOT NULL DEFAULT 'partner',
  min_lead_hours integer NOT NULL DEFAULT 24,
  currency_code text NOT NULL DEFAULT 'EUR',
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, city)
);

CREATE INDEX idx_coverage_zones_country_city ON public.coverage_zones (country, lower(city)) WHERE active;

ALTER TABLE public.coverage_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active coverage zones"
  ON public.coverage_zones FOR SELECT
  TO anon, authenticated
  USING (active = true OR public.is_staff(auth.uid()));

CREATE POLICY "Staff manage coverage zones"
  ON public.coverage_zones FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER update_coverage_zones_updated_at
  BEFORE UPDATE ON public.coverage_zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed common cities
INSERT INTO public.coverage_zones (country, city, coverage_level, min_lead_hours, currency_code) VALUES
  ('SN', 'Dakar',       'direct',  24, 'XOF'),
  ('SN', 'Thiès',       'partner', 48, 'XOF'),
  ('SN', 'Saint-Louis', 'partner', 48, 'XOF'),
  ('SN', 'Mbour',       'partner', 48, 'XOF'),
  ('FR', 'Paris',       'direct',  24, 'EUR'),
  ('FR', 'Lyon',        'partner', 48, 'EUR'),
  ('FR', 'Marseille',   'partner', 48, 'EUR'),
  ('CI', 'Abidjan',     'partner', 48, 'XOF'),
  ('ML', 'Bamako',      'partner', 48, 'XOF'),
  ('BJ', 'Cotonou',     'partner', 48, 'XOF'),
  ('NG', 'Lagos',       'partner', 48, 'NGN'),
  ('AE', 'Dubai',       'partner', 48, 'AED'),
  ('MA', 'Casablanca',  'partner', 48, 'MAD'),
  ('US', 'New York',    'partner', 72, 'USD'),
  ('US', 'Miami',       'partner', 72, 'USD'),
  ('CN', 'Shenzhen',    'partner', 72, 'CNY'),
  ('CN', 'Guangzhou',   'partner', 72, 'CNY');
