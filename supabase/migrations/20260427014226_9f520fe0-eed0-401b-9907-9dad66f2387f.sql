
-- 1) Add WAITING_FOR_MATCH to shipment_status enum
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'WAITING_FOR_MATCH';

-- 2) Add priority + weight_kg to shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal','urgent')),
  ADD COLUMN IF NOT EXISTS weight_kg numeric;

-- 3) konnekt_departures (mirror table)
CREATE TABLE IF NOT EXISTS public.konnekt_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  konnekt_departure_id text UNIQUE NOT NULL,
  transporter_id text,
  origin_country text NOT NULL,
  origin_city text NOT NULL,
  destination_country text NOT NULL,
  destination_city text NOT NULL,
  departure_date date NOT NULL,
  transport text NOT NULL DEFAULT 'AIR',
  total_capacity_kg numeric NOT NULL DEFAULT 0,
  available_capacity_kg numeric NOT NULL DEFAULT 0,
  price_per_kg_eur numeric,
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','FULL','CLOSED','DEPARTED')),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kd_route_date
  ON public.konnekt_departures (origin_city, destination_city, departure_date)
  WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_kd_country_date
  ON public.konnekt_departures (origin_country, destination_country, departure_date)
  WHERE status = 'OPEN';

ALTER TABLE public.konnekt_departures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read open departures"
  ON public.konnekt_departures FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Staff manage departures"
  ON public.konnekt_departures FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_kd_updated
  BEFORE UPDATE ON public.konnekt_departures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) matches table
CREATE TABLE IF NOT EXISTS public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  departure_id uuid NOT NULL REFERENCES public.konnekt_departures(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL,
  transporter_id text,
  score numeric NOT NULL,
  route_score numeric NOT NULL,
  date_score numeric NOT NULL,
  status text NOT NULL DEFAULT 'matched' CHECK (status IN ('matched','in_progress','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_shipment ON public.matches(shipment_id);
CREATE INDEX IF NOT EXISTS idx_matches_user ON public.matches(user_id);

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own matches"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Staff manage matches"
  ON public.matches FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- System inserts via SECURITY DEFINER trigger; no client INSERT needed.

-- 5) Scoring function
CREATE OR REPLACE FUNCTION public.score_departure(
  s_origin_city text, s_origin_country text,
  s_dest_city text,   s_dest_country text,
  s_ready_date date,
  d_origin_city text, d_origin_country text,
  d_dest_city text,   d_dest_country text,
  d_departure_date date
) RETURNS TABLE(route_score numeric, date_score numeric, final_score numeric)
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
DECLARE
  rs numeric := 0;
  ds numeric := 0;
  diff int;
BEGIN
  -- Route scoring
  IF lower(coalesce(d_origin_city,'')) = lower(coalesce(s_origin_city,''))
     AND lower(coalesce(d_dest_city,'')) = lower(coalesce(s_dest_city,'')) THEN
    rs := 1.0;
  ELSIF upper(coalesce(d_origin_country,'')) = upper(coalesce(s_origin_country,''))
     AND upper(coalesce(d_dest_country,'')) = upper(coalesce(s_dest_country,'')) THEN
    rs := 0.7;
  ELSIF upper(coalesce(d_dest_country,'')) = upper(coalesce(s_dest_country,'')) THEN
    rs := 0.5;
  ELSE
    rs := 0.0;
  END IF;

  -- Date scoring: 1 / (1 + days_diff)
  diff := GREATEST(0, (d_departure_date - coalesce(s_ready_date, current_date)));
  ds := 1.0 / (1 + diff);

  route_score := rs;
  date_score := ds;
  final_score := (rs * 0.6) + (ds * 0.4);
  RETURN NEXT;
END;
$$;

-- 6) Auto-match function (SECURITY DEFINER to bypass RLS for system ops)
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
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id;
  IF s IS NULL THEN RETURN NULL; END IF;

  ready := coalesce(s.departure_date, current_date);
  weight := coalesce(s.weight_kg, 1);

  -- Find best open departure
  SELECT d.id AS departure_id, d.transporter_id, sc.route_score, sc.date_score, sc.final_score
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
    UPDATE public.shipments
       SET status = 'WAITING_FOR_MATCH', pending_assignment = true
     WHERE id = p_shipment_id AND status = 'PENDING';
    RETURN NULL;
  END IF;

  -- Create match
  INSERT INTO public.matches (shipment_id, departure_id, user_id, transporter_id, score, route_score, date_score)
  VALUES (p_shipment_id, best.departure_id, s.user_id, best.transporter_id, best.final_score, best.route_score, best.date_score)
  RETURNING id INTO match_id;

  -- Decrement capacity
  UPDATE public.konnekt_departures
     SET available_capacity_kg = GREATEST(0, available_capacity_kg - weight),
         status = CASE WHEN available_capacity_kg - weight <= 0 THEN 'FULL' ELSE status END
   WHERE id = best.departure_id;

  -- Update shipment
  UPDATE public.shipments
     SET status = 'IN_TRANSIT',
         pending_assignment = false,
         konnekt_departure_id = (SELECT konnekt_departure_id FROM public.konnekt_departures WHERE id = best.departure_id)
   WHERE id = p_shipment_id;

  -- Timeline event
  INSERT INTO public.timeline_events (user_id, event_type, title, description, related_shipment_id, metadata)
  VALUES (
    s.user_id, 'SHIPMENT_MATCHED', 'Colis assigné automatiquement',
    'Votre expédition a été prise en charge par un transporteur partenaire.',
    p_shipment_id,
    jsonb_build_object('match_id', match_id, 'score', best.final_score)
  );

  RETURN match_id;
END;
$$;

-- 7) Trigger AFTER INSERT on shipments
CREATE OR REPLACE FUNCTION public.trg_auto_match_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip manual requests (admin assigns) and shipments already linked to a departure
  IF NEW.manual_request = true OR NEW.konnekt_departure_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  PERFORM public.auto_match_shipment(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_match_after_shipment_insert ON public.shipments;
CREATE TRIGGER trg_auto_match_after_shipment_insert
  AFTER INSERT ON public.shipments
  FOR EACH ROW EXECUTE FUNCTION public.trg_auto_match_shipment();

-- 8) Re-match function for waiting shipments (callable by edge cron)
CREATE OR REPLACE FUNCTION public.rematch_waiting_shipments()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  matched_count int := 0;
  m uuid;
BEGIN
  FOR rec IN
    SELECT id FROM public.shipments
    WHERE status = 'WAITING_FOR_MATCH'
    ORDER BY created_at ASC
    LIMIT 200
  LOOP
    m := public.auto_match_shipment(rec.id);
    IF m IS NOT NULL THEN matched_count := matched_count + 1; END IF;
  END LOOP;
  RETURN matched_count;
END;
$$;
