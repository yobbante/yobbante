CREATE TABLE public.fret_tarif_zones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('national','international')),
  code text NOT NULL,
  label text NOT NULL,
  price_s_fcfa integer,
  price_m_fcfa integer,
  price_l_fcfa integer,
  price_per_kg_fcfa integer,
  min_billable_kg numeric(6,2),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, code)
);

CREATE TABLE public.fret_tarif_destinations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id uuid NOT NULL REFERENCES public.fret_tarif_zones(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('national','international')),
  name text NOT NULL,
  country_code text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, name)
);

CREATE INDEX idx_fret_tarif_destinations_zone ON public.fret_tarif_destinations(zone_id);

GRANT SELECT ON public.fret_tarif_zones TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fret_tarif_zones TO authenticated;
GRANT ALL ON public.fret_tarif_zones TO service_role;

GRANT SELECT ON public.fret_tarif_destinations TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fret_tarif_destinations TO authenticated;
GRANT ALL ON public.fret_tarif_destinations TO service_role;

ALTER TABLE public.fret_tarif_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fret_tarif_destinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fret_tarif_zones_public_read" ON public.fret_tarif_zones FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fret_tarif_zones_admin_write" ON public.fret_tarif_zones FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "fret_tarif_destinations_public_read" ON public.fret_tarif_destinations FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "fret_tarif_destinations_admin_write" ON public.fret_tarif_destinations FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_fret_tarif_zones_updated BEFORE UPDATE ON public.fret_tarif_zones FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_fret_tarif_destinations_updated BEFORE UPDATE ON public.fret_tarif_destinations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();