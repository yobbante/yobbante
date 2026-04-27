
-- 1) ETA monitoring: flag late shipments
CREATE OR REPLACE FUNCTION public.monitor_shipment_etas()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  flagged int := 0;
BEGIN
  FOR rec IN
    SELECT id, tracking_number, eta, status
    FROM public.shipments
    WHERE status IN ('IN_TRANSIT','CUSTOMS','OUT_FOR_DELIVERY','ARRIVED')
      AND eta IS NOT NULL
      AND eta < now() - interval '24 hours'
  LOOP
    UPDATE public.shipments
       SET status = 'ON_HOLD'
     WHERE id = rec.id;

    INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, note, metadata)
    VALUES (
      rec.id, 'eta_exceeded', 'system',
      '⏰ ETA dépassée de plus de 24h — intervention requise',
      jsonb_build_object('eta', rec.eta, 'previous_status', rec.status)
    );
    flagged := flagged + 1;
  END LOOP;
  RETURN flagged;
END;
$$;

-- 2) Payment timeouts: cancel unpaid PENDING > 48h
CREATE OR REPLACE FUNCTION public.expire_unpaid_shipments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec record;
  cancelled int := 0;
  weight numeric;
BEGIN
  FOR rec IN
    SELECT id, weight_kg, manual_departure_id, konnekt_departure_id, assigned_departure_source
    FROM public.shipments
    WHERE status = 'PENDING'
      AND payment_status = 'unpaid'
      AND created_at < now() - interval '48 hours'
  LOOP
    weight := COALESCE(rec.weight_kg, 0);

    UPDATE public.shipments
       SET status = 'CANCELLED', pending_assignment = false
     WHERE id = rec.id;

    -- release capacity if it had been reserved
    IF rec.assigned_departure_source = 'manual' AND rec.manual_departure_id IS NOT NULL AND weight > 0 THEN
      UPDATE public.manual_departures
         SET available_capacity_kg = available_capacity_kg + weight::int,
             status = CASE WHEN status = 'full' THEN 'active' ELSE status END
       WHERE id = rec.manual_departure_id;
    ELSIF rec.assigned_departure_source = 'konnekt' AND rec.konnekt_departure_id IS NOT NULL AND weight > 0 THEN
      UPDATE public.konnekt_departures
         SET available_capacity_kg = available_capacity_kg + weight,
             status = CASE WHEN status = 'FULL' THEN 'OPEN' ELSE status END
       WHERE konnekt_departure_id = rec.konnekt_departure_id;
    END IF;

    INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, note, metadata)
    VALUES (
      rec.id, 'payment_timeout', 'system',
      '❌ Paiement non reçu sous 48h — envoi annulé automatiquement',
      jsonb_build_object('cancelled_at', now())
    );
    cancelled := cancelled + 1;
  END LOOP;
  RETURN cancelled;
END;
$$;

-- 3) Auto-progress shipments whose departure date has come
CREATE OR REPLACE FUNCTION public.auto_progress_departures()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  moved int := 0;
BEGIN
  WITH upd AS (
    UPDATE public.shipments
       SET status = 'IN_TRANSIT'
     WHERE status IN ('MATCHED','IN_PREPARATION')
       AND departure_date IS NOT NULL
       AND departure_date <= current_date
     RETURNING id
  )
  SELECT count(*) INTO moved FROM upd;
  RETURN moved;
END;
$$;

-- Ensure pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
