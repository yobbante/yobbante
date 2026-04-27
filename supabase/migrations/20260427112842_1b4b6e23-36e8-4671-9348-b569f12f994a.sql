
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS assigned_departure_source text
    CHECK (assigned_departure_source IN ('konnekt','manual')),
  ADD COLUMN IF NOT EXISTS manual_departure_id uuid REFERENCES public.manual_departures(id);

DROP VIEW IF EXISTS public.all_active_departures CASCADE;

CREATE VIEW public.all_active_departures AS
SELECT
  d.id,
  'konnekt'::text AS source,
  d.konnekt_departure_id AS external_id,
  d.transporter_id,
  NULL::text AS carrier_name,
  d.origin_country,
  d.origin_city,
  d.destination_country,
  d.destination_city,
  d.departure_date,
  lower(d.transport) AS transport_mode,
  d.total_capacity_kg,
  d.available_capacity_kg,
  d.price_per_kg_eur,
  NULL::integer AS price_override_xof,
  d.status
FROM public.konnekt_departures d
WHERE d.status = 'OPEN'
  AND d.available_capacity_kg > 0
  AND d.departure_date >= current_date

UNION ALL

SELECT
  m.id,
  'manual'::text AS source,
  NULL::text AS external_id,
  NULL::text AS transporter_id,
  m.carrier_name,
  m.origin_country,
  m.origin_city,
  m.destination_country,
  m.destination_city,
  m.departure_date,
  lower(m.transport_mode) AS transport_mode,
  m.total_capacity_kg::numeric AS total_capacity_kg,
  m.available_capacity_kg::numeric AS available_capacity_kg,
  NULL::numeric AS price_per_kg_eur,
  m.price_override_xof,
  m.status
FROM public.manual_departures m
WHERE m.status = 'active'
  AND m.available_capacity_kg > 0
  AND m.departure_date >= current_date;

GRANT SELECT ON public.all_active_departures TO authenticated;

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
  is_express boolean;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id;
  IF s IS NULL THEN RETURN NULL; END IF;

  IF s.manual_request = true OR s.konnekt_departure_id IS NOT NULL OR s.manual_departure_id IS NOT NULL THEN
    RETURN NULL;
  END IF;

  ready := coalesce(s.departure_date, current_date);
  weight := coalesce(s.weight_kg, 1);
  is_express := lower(coalesce(s.priority, 'normal')) IN ('express','urgent','fast');

  SELECT d.id AS departure_id, d.source, d.transporter_id, d.transport_mode,
         d.external_id, d.departure_date,
         sc.route_score, sc.date_score, sc.final_score
  INTO best
  FROM public.all_active_departures d
  CROSS JOIN LATERAL public.score_departure(
    s.origin_city, s.origin_country::text,
    s.destination_city, s.destination_country,
    ready,
    d.origin_city, d.origin_country,
    d.destination_city, d.destination_country,
    d.departure_date
  ) sc
  WHERE d.available_capacity_kg >= weight
    AND d.departure_date >= ready
    AND sc.route_score > 0
    AND (s.transport_type IS NULL OR lower(s.transport_type) = d.transport_mode OR s.transport_type IN ('fast','economy','volume'))
  ORDER BY
    CASE WHEN is_express THEN d.departure_date END ASC NULLS LAST,
    sc.final_score DESC,
    d.available_capacity_kg DESC,
    d.departure_date ASC
  LIMIT 1;

  IF best IS NULL THEN
    UPDATE public.shipments
       SET status = 'ON_HOLD',
           pending_assignment = true
     WHERE id = p_shipment_id
       AND status IN ('PENDING','CONFIRMED','WAITING_FOR_MATCH');

    INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, note, metadata)
    VALUES (
      p_shipment_id, 'no_departure_found', 'system',
      '⚠️ Aucun départ disponible — assignation manuelle requise',
      jsonb_build_object(
        'origin', jsonb_build_object('city', s.origin_city, 'country', s.origin_country),
        'destination', jsonb_build_object('city', s.destination_city, 'country', s.destination_country),
        'weight_kg', weight,
        'priority', s.priority
      )
    );
    RETURN NULL;
  END IF;

  IF best.source = 'konnekt' THEN
    INSERT INTO public.matches (shipment_id, departure_id, user_id, transporter_id, score, route_score, date_score)
    VALUES (p_shipment_id, best.departure_id, s.user_id, best.transporter_id, best.final_score, best.route_score, best.date_score)
    RETURNING id INTO match_id;

    UPDATE public.konnekt_departures
       SET available_capacity_kg = GREATEST(0, available_capacity_kg - weight),
           status = CASE WHEN available_capacity_kg - weight <= 0 THEN 'FULL' ELSE status END
     WHERE id = best.departure_id;

    UPDATE public.shipments
       SET status = 'MATCHED',
           pending_assignment = false,
           assigned_departure_source = 'konnekt',
           konnekt_departure_id = best.external_id,
           departure_date = best.departure_date
     WHERE id = p_shipment_id;
  ELSE
    UPDATE public.manual_departures
       SET available_capacity_kg = GREATEST(0, available_capacity_kg - weight::int),
           status = CASE WHEN available_capacity_kg - weight::int <= 0 THEN 'full' ELSE status END
     WHERE id = best.departure_id;

    UPDATE public.shipments
       SET status = 'MATCHED',
           pending_assignment = false,
           assigned_departure_source = 'manual',
           manual_departure_id = best.departure_id,
           departure_date = best.departure_date
     WHERE id = p_shipment_id;
  END IF;

  BEGIN
    SELECT * INTO q FROM public.calculate_quote(
      s.origin_country::text, s.destination_country, weight,
      best.transport_mode, s.priority, s.origin_city, s.destination_city
    );
    UPDATE public.shipments
       SET total_cost = COALESCE(total_cost, q.price_eur),
           transport_metadata = COALESCE(transport_metadata, '{}'::jsonb) || jsonb_build_object(
             'matched_source', best.source,
             'matched_departure_id', best.departure_id,
             'quote', jsonb_build_object(
               'price_eur', q.price_eur,
               'eta_min_days', q.eta_min_days,
               'eta_max_days', q.eta_max_days
             )
           )
     WHERE id = p_shipment_id;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, note, metadata)
  VALUES (
    p_shipment_id, 'departure_matched', 'system',
    'Départ assigné (' || best.source || ') — ' || to_char(best.departure_date, 'DD/MM/YYYY'),
    jsonb_build_object(
      'source', best.source,
      'departure_id', best.departure_id,
      'departure_date', best.departure_date,
      'score', best.final_score
    )
  );

  RETURN COALESCE(match_id, best.departure_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auto_match_shipment(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_auto_match_shipment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.manual_request = true
     OR NEW.konnekt_departure_id IS NOT NULL
     OR NEW.manual_departure_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' AND NEW.status IN ('PENDING','CONFIRMED') THEN
    PERFORM public.auto_match_shipment(NEW.id);
  ELSIF TG_OP = 'UPDATE'
        AND NEW.status = 'CONFIRMED'
        AND OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM public.auto_match_shipment(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_auto_match_shipment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_shipments_auto_match ON public.shipments;
CREATE TRIGGER trg_shipments_auto_match
AFTER INSERT OR UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.trg_auto_match_shipment();

CREATE OR REPLACE FUNCTION public.rematch_waiting_shipments()
RETURNS integer
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
    WHERE status IN ('WAITING_FOR_MATCH','ON_HOLD')
      AND manual_request = false
      AND konnekt_departure_id IS NULL
      AND manual_departure_id IS NULL
    ORDER BY created_at ASC
    LIMIT 200
  LOOP
    m := public.auto_match_shipment(rec.id);
    IF m IS NOT NULL THEN matched_count := matched_count + 1; END IF;
  END LOOP;
  RETURN matched_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.rematch_waiting_shipments() FROM PUBLIC, anon, authenticated;
