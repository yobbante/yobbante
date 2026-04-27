
-- 1) routes_pricing table
CREATE TABLE IF NOT EXISTS public.routes_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  origin_country text NOT NULL,
  origin_city text,
  destination_country text NOT NULL,
  destination_city text,
  transport_type text NOT NULL DEFAULT 'AIR' CHECK (transport_type IN ('AIR','SEA','ROAD','GP')),
  base_price_eur numeric NOT NULL DEFAULT 0,
  price_per_kg_eur numeric NOT NULL DEFAULT 0,
  eta_min_days int NOT NULL DEFAULT 7,
  eta_max_days int NOT NULL DEFAULT 14,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routes_lookup
  ON public.routes_pricing (origin_country, destination_country, transport_type)
  WHERE active = true;

ALTER TABLE public.routes_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read pricing"
  ON public.routes_pricing FOR SELECT
  TO authenticated
  USING (active = true OR public.is_staff(auth.uid()));

CREATE POLICY "Staff manage pricing"
  ON public.routes_pricing FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_routes_pricing_updated
  BEFORE UPDATE ON public.routes_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Seed initial pricing (CN/FR/US -> SN, AIR + SEA)
INSERT INTO public.routes_pricing
  (origin_country, destination_country, transport_type, base_price_eur, price_per_kg_eur, eta_min_days, eta_max_days)
VALUES
  ('CN','SN','AIR', 35, 12, 5, 9),
  ('CN','SN','SEA', 25,  3, 30, 45),
  ('FR','SN','AIR', 30, 10, 3, 6),
  ('FR','SN','SEA', 20,  2, 18, 28),
  ('US','SN','AIR', 40, 14, 6, 10),
  ('US','SN','SEA', 30,  4, 28, 42);

-- 3) calculate_quote function (STABLE, safe to expose)
CREATE OR REPLACE FUNCTION public.calculate_quote(
  p_origin_country text,
  p_destination_country text,
  p_weight_kg numeric,
  p_transport_type text DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_origin_city text DEFAULT NULL,
  p_destination_city text DEFAULT NULL
) RETURNS TABLE(
  price_eur numeric,
  currency text,
  eta_min_days int,
  eta_max_days int,
  transport_type text,
  confidence text,
  base_price_eur numeric,
  weight_cost_eur numeric,
  urgency_multiplier numeric,
  supply_adjustment_eur numeric,
  margin_multiplier numeric
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  weight numeric := GREATEST(0.5, COALESCE(p_weight_kg, 1));
  base numeric;
  per_kg numeric;
  weight_cost numeric;
  mult numeric;
  supply_adj numeric := 0;
  open_caps numeric;
  raw_price numeric;
  final numeric;
  margin CONSTANT numeric := 1.20;
  conf text;
BEGIN
  -- Find matching route (transport-specific first, then any active)
  SELECT *
    INTO r
    FROM public.routes_pricing
   WHERE active = true
     AND upper(origin_country) = upper(p_origin_country)
     AND upper(destination_country) = upper(p_destination_country)
     AND (p_transport_type IS NULL OR transport_type = upper(p_transport_type))
   ORDER BY (CASE WHEN p_transport_type IS NOT NULL AND transport_type = upper(p_transport_type) THEN 0 ELSE 1 END),
            base_price_eur ASC
   LIMIT 1;

  IF r IS NULL THEN
    -- Fallback: generic pricing so we ALWAYS return a quote
    base := 30;
    per_kg := 8;
    transport_type := COALESCE(upper(p_transport_type), 'AIR');
    eta_min_days := 7;
    eta_max_days := 21;
    conf := 'low';
  ELSE
    base := r.base_price_eur;
    per_kg := r.price_per_kg_eur;
    transport_type := r.transport_type;
    eta_min_days := r.eta_min_days;
    eta_max_days := r.eta_max_days;
    conf := 'high';
  END IF;

  weight_cost := weight * per_kg;
  mult := CASE WHEN lower(COALESCE(p_priority,'normal')) = 'urgent' THEN 1.3 ELSE 1.0 END;

  -- Supply adjustment from konnekt_departures (next 30 days, OPEN, route match)
  SELECT COALESCE(SUM(available_capacity_kg), 0)
    INTO open_caps
    FROM public.konnekt_departures
   WHERE status = 'OPEN'
     AND departure_date >= current_date
     AND departure_date <= current_date + interval '30 days'
     AND upper(origin_country) = upper(p_origin_country)
     AND upper(destination_country) = upper(p_destination_country);

  raw_price := (base + weight_cost) * mult;

  IF open_caps >= weight * 50 THEN
    supply_adj := -0.10 * raw_price; -- abundant supply: -10%
  ELSIF open_caps < weight * 2 THEN
    supply_adj := 0.15 * raw_price;  -- scarce supply: +15%
    IF conf = 'high' THEN conf := 'medium'; END IF;
  END IF;

  final := (raw_price + supply_adj) * margin;

  price_eur := round(final::numeric, 2);
  currency := 'EUR';
  base_price_eur := base;
  weight_cost_eur := round(weight_cost::numeric, 2);
  urgency_multiplier := mult;
  supply_adjustment_eur := round(supply_adj::numeric, 2);
  margin_multiplier := margin;
  confidence := conf;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_quote(text,text,numeric,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_quote(text,text,numeric,text,text,text,text) TO authenticated;

-- 4) Hook pricing into matching trigger
CREATE OR REPLACE FUNCTION public.auto_match_shipment(p_shipment_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  best record;
  match_id uuid;
  ready date;
  weight numeric;
  q record;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id;
  IF s IS NULL THEN RETURN NULL; END IF;

  ready := coalesce(s.departure_date, current_date);
  weight := coalesce(s.weight_kg, 1);

  SELECT d.id AS departure_id, d.transporter_id, d.transport,
         sc.route_score, sc.date_score, sc.final_score
  INTO best
  FROM public.konnekt_departures d
  CROSS JOIN LATERAL public.score_departure(
    s.origin_city, s.origin_country::text,
    s.destination_city, s.destination_country,
    ready,
    d.origin_city, d.origin_country,
    d.destination_city, d.destination_country,
    d.departure_date
  ) sc
  WHERE d.status = 'OPEN'
    AND d.available_capacity_kg >= weight
    AND d.departure_date >= ready
    AND sc.route_score > 0
  ORDER BY sc.final_score DESC, d.departure_date ASC
  LIMIT 1;

  IF best IS NULL THEN
    -- Even waiting shipments get a quote so the user sees a price
    SELECT * INTO q FROM public.calculate_quote(
      s.origin_country::text, s.destination_country, weight,
      s.transport_type, s.priority, s.origin_city, s.destination_city
    );
    UPDATE public.shipments
       SET status = 'WAITING_FOR_MATCH',
           pending_assignment = true,
           total_cost = COALESCE(total_cost, q.price_eur)
     WHERE id = p_shipment_id AND status = 'PENDING';
    RETURN NULL;
  END IF;

  INSERT INTO public.matches (shipment_id, departure_id, user_id, transporter_id, score, route_score, date_score)
  VALUES (p_shipment_id, best.departure_id, s.user_id, best.transporter_id, best.final_score, best.route_score, best.date_score)
  RETURNING id INTO match_id;

  UPDATE public.konnekt_departures
     SET available_capacity_kg = GREATEST(0, available_capacity_kg - weight),
         status = CASE WHEN available_capacity_kg - weight <= 0 THEN 'FULL' ELSE status END
   WHERE id = best.departure_id;

  -- Compute quote with the actual matched transport mode
  SELECT * INTO q FROM public.calculate_quote(
    s.origin_country::text, s.destination_country, weight,
    best.transport, s.priority, s.origin_city, s.destination_city
  );

  UPDATE public.shipments
     SET status = 'IN_TRANSIT',
         pending_assignment = false,
         konnekt_departure_id = (SELECT konnekt_departure_id FROM public.konnekt_departures WHERE id = best.departure_id),
         total_cost = q.price_eur,
         transport_metadata = COALESCE(transport_metadata, '{}'::jsonb) || jsonb_build_object(
           'quote', jsonb_build_object(
             'price_eur', q.price_eur,
             'base_price_eur', q.base_price_eur,
             'weight_cost_eur', q.weight_cost_eur,
             'urgency_multiplier', q.urgency_multiplier,
             'supply_adjustment_eur', q.supply_adjustment_eur,
             'margin_multiplier', q.margin_multiplier,
             'eta_min_days', q.eta_min_days,
             'eta_max_days', q.eta_max_days,
             'confidence', q.confidence
           )
         )
   WHERE id = p_shipment_id;

  INSERT INTO public.timeline_events (user_id, event_type, title, description, related_shipment_id, metadata)
  VALUES (
    s.user_id, 'SHIPMENT_MATCHED', 'Colis assigné automatiquement',
    'Votre expédition a été prise en charge par un transporteur partenaire.',
    p_shipment_id,
    jsonb_build_object('match_id', match_id, 'score', best.final_score, 'price_eur', q.price_eur)
  );

  RETURN match_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_match_shipment(uuid) FROM PUBLIC, anon, authenticated;
