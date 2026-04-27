-- Fix cancel_shipment: restore exact reserved capacity, clamp to total_capacity, ensure idempotency
CREATE OR REPLACE FUNCTION public.cancel_shipment(p_shipment_id uuid, p_reason text DEFAULT 'Manual cancellation'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s record;
  weight numeric;
  weight_int int;
  refund_id uuid;
  refund_amount numeric;
  released_kg numeric := 0;
  release_target text := NULL;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF s.status = 'CANCELLED' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled');
  END IF;
  IF s.status = 'DELIVERED' THEN
    RAISE EXCEPTION 'Cannot cancel a delivered shipment';
  END IF;

  weight := COALESCE(s.weight_kg, 0);
  weight_int := GREATEST(0, ceil(weight))::int; -- conservative round-up to match reservation rounding

  -- Release capacity, clamped to total_capacity to prevent overflow on retries / partial states
  IF s.assigned_departure_source = 'manual'
     AND s.manual_departure_id IS NOT NULL
     AND weight_int > 0 THEN
    UPDATE public.manual_departures md
       SET available_capacity_kg = LEAST(
             md.total_capacity_kg,
             md.available_capacity_kg + weight_int
           ),
           status = CASE
             WHEN md.status = 'full'
              AND (md.available_capacity_kg + weight_int) > 0
             THEN 'active'
             ELSE md.status
           END,
           updated_at = now()
     WHERE md.id = s.manual_departure_id
     RETURNING (LEAST(md.total_capacity_kg, md.available_capacity_kg) - (md.available_capacity_kg - weight_int))
        INTO released_kg;
    released_kg := COALESCE(released_kg, weight_int);
    release_target := 'manual:' || s.manual_departure_id::text;

  ELSIF s.assigned_departure_source = 'konnekt'
        AND s.konnekt_departure_id IS NOT NULL
        AND weight > 0 THEN
    UPDATE public.konnekt_departures kd
       SET available_capacity_kg = LEAST(
             kd.total_capacity_kg,
             kd.available_capacity_kg + weight
           ),
           status = CASE
             WHEN kd.status = 'FULL'
              AND (kd.available_capacity_kg + weight) > 0
             THEN 'OPEN'
             ELSE kd.status
           END,
           updated_at = now()
     WHERE kd.konnekt_departure_id = s.konnekt_departure_id
     RETURNING (LEAST(kd.total_capacity_kg, kd.available_capacity_kg) - (kd.available_capacity_kg - weight))
        INTO released_kg;
    released_kg := COALESCE(released_kg, weight);
    release_target := 'konnekt:' || s.konnekt_departure_id;
  END IF;

  UPDATE public.shipments
     SET status = 'CANCELLED', pending_assignment = false
   WHERE id = p_shipment_id;

  -- Queue refund if paid
  IF s.payment_status = 'paid' AND COALESCE(s.total_cost, 0) > 0 THEN
    refund_amount := s.total_cost;
    INSERT INTO public.refund_requests (shipment_id, user_id, amount_eur, reason, status)
    VALUES (p_shipment_id, s.user_id, refund_amount, p_reason, 'pending')
    RETURNING id INTO refund_id;
  END IF;

  INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, from_status, to_status, note, metadata)
  VALUES (
    p_shipment_id, 'shipment_cancelled', 'admin', s.status::text, 'CANCELLED',
    p_reason,
    jsonb_build_object(
      'refund_id', refund_id,
      'refund_amount_eur', refund_amount,
      'released_kg', released_kg,
      'release_target', release_target,
      'reserved_kg', weight
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'refund_id', refund_id,
    'refund_amount_eur', refund_amount,
    'released_kg', released_kg,
    'release_target', release_target
  );
END;
$function$;