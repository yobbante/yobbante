
-- 1) Add cancellation tracking columns on dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by text;

-- 2) RPC: client cancels a SUBMITTED dossier (no departure yet)
CREATE OR REPLACE FUNCTION public.client_cancel_dossier(
  p_dossier_id uuid,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  v_msg text;
BEGIN
  SELECT * INTO d FROM public.dossiers WHERE id = p_dossier_id FOR UPDATE;
  IF d IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF d.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF d.status <> 'SUBMITTED' OR d.assigned_departure_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_cancel_now');
  END IF;

  UPDATE public.dossiers
     SET status = 'CLOSED',
         cancelled_at = now(),
         cancelled_by = 'client',
         client_departure_decision = 'cancelled',
         client_departure_decided_at = now(),
         client_departure_note = p_reason
   WHERE id = p_dossier_id;

  BEGIN
    INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
    VALUES (p_dossier_id, 'client_cancelled', jsonb_build_object('reason', p_reason), true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_msg := 'Dossier annule par le client : ' || COALESCE(d.tracking_id, d.reference, d.id::text)
        || CASE WHEN p_reason IS NOT NULL THEN E'\nRaison : ' || p_reason ELSE '' END;
  PERFORM public.enqueue_admin_notification('client_cancelled_dossier', v_msg, p_dossier_id, jsonb_build_object('reason', p_reason));

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_cancel_dossier(uuid, text) TO authenticated;

-- 3) Public RPC: confirm or refuse an assigned departure by tracking id (no auth required)
CREATE OR REPLACE FUNCTION public.confirm_departure_public(
  p_tracking text,
  p_confirmed boolean,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  v_decision text;
  v_msg text;
BEGIN
  IF p_tracking IS NULL OR length(btrim(p_tracking)) < 3 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_tracking');
  END IF;
  SELECT * INTO d FROM public.dossiers
   WHERE tracking_id = p_tracking OR reference = p_tracking
   LIMIT 1;
  IF d IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF d.assigned_departure_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_departure_assigned');
  END IF;
  IF d.client_departure_decision IS NOT NULL
     AND d.client_departure_decision NOT IN ('pending') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'already_decided', 'decision', d.client_departure_decision);
  END IF;

  v_decision := CASE WHEN p_confirmed THEN 'confirmed' ELSE 'cancelled' END;

  UPDATE public.dossiers
     SET client_departure_decision = v_decision,
         client_departure_decided_at = now(),
         client_departure_note = p_reason,
         assigned_departure_id = CASE WHEN p_confirmed THEN assigned_departure_id ELSE NULL END
   WHERE id = d.id;

  BEGIN
    INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
    VALUES (d.id, 'client_departure_decision_public', jsonb_build_object('decision', v_decision, 'reason', p_reason), true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_msg := 'Decision client (public) : ' || COALESCE(d.tracking_id, d.reference, d.id::text)
        || ' -> ' || v_decision
        || CASE WHEN p_reason IS NOT NULL THEN E'\nRaison : ' || p_reason ELSE '' END;
  PERFORM public.enqueue_admin_notification('client_departure_decision', v_msg, d.id,
    jsonb_build_object('decision', v_decision, 'reason', p_reason, 'source', 'public_track'));

  RETURN jsonb_build_object('ok', true, 'decision', v_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_departure_public(text, boolean, text) TO anon, authenticated;

-- 4) RPC: client updates pickup_date / sender_address on a not-yet-confirmed dossier
CREATE OR REPLACE FUNCTION public.client_update_pickup(
  p_dossier_id uuid,
  p_pickup_date date DEFAULT NULL,
  p_pickup_address text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d RECORD;
  v_changes jsonb := '[]'::jsonb;
  v_msg text;
BEGIN
  SELECT * INTO d FROM public.dossiers WHERE id = p_dossier_id FOR UPDATE;
  IF d IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  IF d.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF d.status NOT IN ('SUBMITTED','IN_REVIEW','SOURCING','PROCURED')
     OR COALESCE(d.client_departure_decision,'pending') = 'confirmed' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'cannot_edit_now');
  END IF;

  IF p_pickup_date IS NOT NULL AND p_pickup_date IS DISTINCT FROM d.pickup_date THEN
    UPDATE public.dossiers SET pickup_date = p_pickup_date WHERE id = d.id;
    v_changes := v_changes || jsonb_build_object('field','pickup_date','old',d.pickup_date,'new',p_pickup_date);
  END IF;
  IF p_pickup_address IS NOT NULL AND NULLIF(btrim(p_pickup_address),'') IS DISTINCT FROM d.sender_address THEN
    UPDATE public.dossiers SET sender_address = NULLIF(btrim(p_pickup_address),'') WHERE id = d.id;
    v_changes := v_changes || jsonb_build_object('field','sender_address','old',d.sender_address,'new',p_pickup_address);
  END IF;

  IF jsonb_array_length(v_changes) = 0 THEN
    RETURN jsonb_build_object('ok', true, 'changes', v_changes);
  END IF;

  BEGIN
    INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
    VALUES (p_dossier_id, 'client_pickup_updated', jsonb_build_object('changes', v_changes), true);
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  v_msg := 'Le client a modifie sa collecte : ' || COALESCE(d.tracking_id, d.reference, d.id::text);
  PERFORM public.enqueue_admin_notification('client_pickup_updated', v_msg, p_dossier_id, jsonb_build_object('changes', v_changes));

  RETURN jsonb_build_object('ok', true, 'changes', v_changes);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_update_pickup(uuid, date, text) TO authenticated;
