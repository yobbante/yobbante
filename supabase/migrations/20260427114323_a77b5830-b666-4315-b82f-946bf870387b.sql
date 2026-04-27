
-- Staff override policies on shipments
CREATE POLICY "Staff view all shipments"
  ON public.shipments FOR SELECT TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff update all shipments"
  ON public.shipments FOR UPDATE TO authenticated
  USING (is_staff(auth.uid()));

CREATE POLICY "Staff insert shipments"
  ON public.shipments FOR INSERT TO authenticated
  WITH CHECK (is_staff(auth.uid()));

-- Refund tracking table
CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL,
  user_id uuid,
  amount_eur numeric,
  reason text,
  status text NOT NULL DEFAULT 'pending', -- pending | sent | completed | failed
  attempts integer NOT NULL DEFAULT 0,
  provider_ref text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage refunds"
  ON public.refund_requests FOR ALL TO authenticated
  USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

CREATE POLICY "Users view own refunds"
  ON public.refund_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR is_staff(auth.uid()));

-- Cancel shipment with capacity release + refund queueing
CREATE OR REPLACE FUNCTION public.cancel_shipment(p_shipment_id uuid, p_reason text DEFAULT 'Manual cancellation')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s record;
  weight numeric;
  refund_id uuid;
  refund_amount numeric;
BEGIN
  SELECT * INTO s FROM public.shipments WHERE id = p_shipment_id FOR UPDATE;
  IF s IS NULL THEN RAISE EXCEPTION 'Shipment not found'; END IF;
  IF s.status = 'CANCELLED' THEN RETURN jsonb_build_object('ok', false, 'reason', 'already_cancelled'); END IF;
  IF s.status = 'DELIVERED' THEN RAISE EXCEPTION 'Cannot cancel a delivered shipment'; END IF;

  weight := COALESCE(s.weight_kg, 0);

  -- Release capacity
  IF s.assigned_departure_source = 'manual' AND s.manual_departure_id IS NOT NULL AND weight > 0 THEN
    UPDATE public.manual_departures
       SET available_capacity_kg = available_capacity_kg + weight::int,
           status = CASE WHEN status = 'full' THEN 'active' ELSE status END
     WHERE id = s.manual_departure_id;
  ELSIF s.assigned_departure_source = 'konnekt' AND s.konnekt_departure_id IS NOT NULL AND weight > 0 THEN
    UPDATE public.konnekt_departures
       SET available_capacity_kg = available_capacity_kg + weight,
           status = CASE WHEN status = 'FULL' THEN 'OPEN' ELSE status END
     WHERE konnekt_departure_id = s.konnekt_departure_id;
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
    jsonb_build_object('refund_id', refund_id, 'refund_amount_eur', refund_amount)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'shipment_id', p_shipment_id,
    'refund_id', refund_id,
    'refund_amount_eur', refund_amount
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_shipment(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_shipment(uuid, text) TO authenticated;
