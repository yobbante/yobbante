-- Manual departures table (admin-managed)
CREATE TABLE IF NOT EXISTS public.manual_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country text,
  origin_city text NOT NULL,
  destination_country text,
  destination_city text NOT NULL,
  transport_mode text NOT NULL CHECK (transport_mode IN ('air','sea_lcl','road')),
  departure_date date NOT NULL,
  arrival_estimate date,
  total_capacity_kg integer NOT NULL CHECK (total_capacity_kg >= 0),
  available_capacity_kg integer NOT NULL CHECK (available_capacity_kg >= 0),
  price_override_xof integer,
  carrier_name text,
  carrier_contact text,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('active','full','cancelled','draft')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (available_capacity_kg <= total_capacity_kg)
);

ALTER TABLE public.manual_departures ENABLE ROW LEVEL SECURITY;

-- Staff can do everything
CREATE POLICY "Staff manage manual departures"
  ON public.manual_departures FOR ALL
  TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

-- Authenticated users can read active departures (for matching/quote display)
CREATE POLICY "Read active manual departures"
  ON public.manual_departures FOR SELECT
  TO authenticated
  USING (status = 'active');

-- updated_at trigger
CREATE TRIGGER manual_departures_updated_at
  BEFORE UPDATE ON public.manual_departures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-mark as 'full' when available capacity hits 0 (only when active)
CREATE OR REPLACE FUNCTION public.manual_departures_auto_full()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'active' AND NEW.available_capacity_kg <= 0 THEN
    NEW.status := 'full';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER manual_departures_auto_full_trg
  BEFORE INSERT OR UPDATE OF available_capacity_kg, status ON public.manual_departures
  FOR EACH ROW EXECUTE FUNCTION public.manual_departures_auto_full();

CREATE INDEX idx_manual_departures_route_date
  ON public.manual_departures (origin_city, destination_city, departure_date);
CREATE INDEX idx_manual_departures_status
  ON public.manual_departures (status, departure_date);

-- Unified view: konnekt + manual departures with the same shape
CREATE OR REPLACE VIEW public.all_active_departures AS
  SELECT
    id,
    'konnekt'::text                  AS source,
    konnekt_departure_id             AS external_id,
    origin_country,
    origin_city,
    destination_country,
    destination_city,
    transport                        AS transport_mode,
    departure_date,
    NULL::date                       AS arrival_estimate,
    total_capacity_kg::integer       AS total_capacity_kg,
    available_capacity_kg::integer   AS available_capacity_kg,
    NULL::integer                    AS price_override_xof,
    NULL::text                       AS carrier_name,
    status,
    created_at
  FROM public.konnekt_departures
  WHERE status = 'OPEN'
  UNION ALL
  SELECT
    id,
    'manual'::text                   AS source,
    NULL::text                       AS external_id,
    origin_country,
    origin_city,
    destination_country,
    destination_city,
    transport_mode,
    departure_date,
    arrival_estimate,
    total_capacity_kg,
    available_capacity_kg,
    price_override_xof,
    carrier_name,
    status,
    created_at
  FROM public.manual_departures
  WHERE status = 'active';

GRANT SELECT ON public.all_active_departures TO authenticated, anon;