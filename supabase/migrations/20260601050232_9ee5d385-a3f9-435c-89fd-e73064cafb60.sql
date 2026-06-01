
-- 1) Fix RPC : cast dossier_status to text for ANY comparison
CREATE OR REPLACE FUNCTION public.assign_dossier_to_departure(p_dossier_id uuid, p_departure_id uuid, p_transporteur_ref text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  d record;
  dep record;
  old_dep_id uuid;
  weight numeric;
  early_statuses text[] := ARRAY['SUBMITTED','AWAITING_CLIENT','IN_REVIEW','CONFIRMED','PROCURED'];
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM public.dossiers WHERE id = p_dossier_id FOR UPDATE;
  IF d IS NULL THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;

  SELECT * INTO dep FROM public.manual_departures WHERE id = p_departure_id FOR UPDATE;
  IF dep IS NULL THEN RAISE EXCEPTION 'Depart introuvable'; END IF;
  IF dep.status IN ('cancelled') THEN
    RAISE EXCEPTION 'Depart annule, impossible d''assigner';
  END IF;

  weight := COALESCE(d.actual_weight_kg, d.estimated_weight, 0);
  old_dep_id := d.assigned_departure_id;

  IF old_dep_id IS NOT NULL AND old_dep_id <> p_departure_id THEN
    UPDATE public.manual_departures md
       SET reserved_capacity_kg = GREATEST(0, COALESCE(md.reserved_capacity_kg, 0) - weight),
           available_capacity_kg = LEAST(md.total_capacity_kg,
             md.total_capacity_kg - GREATEST(0, COALESCE(md.reserved_capacity_kg, 0) - weight)::int),
           status = CASE WHEN md.status = 'full' THEN 'active' ELSE md.status END,
           updated_at = now()
     WHERE md.id = old_dep_id;
  END IF;

  IF old_dep_id IS DISTINCT FROM p_departure_id THEN
    UPDATE public.manual_departures md
       SET reserved_capacity_kg = COALESCE(md.reserved_capacity_kg, 0) + weight,
           available_capacity_kg = GREATEST(0,
             md.total_capacity_kg - (COALESCE(md.reserved_capacity_kg, 0) + weight)::int),
           updated_at = now()
     WHERE md.id = p_departure_id;
  END IF;

  UPDATE public.dossiers
     SET assigned_departure_id = p_departure_id,
         assigned_transporteur_ref = COALESCE(p_transporteur_ref, dep.transporteur_ref, assigned_transporteur_ref),
         estimated_delivery_date = COALESCE(dep.arrival_estimate, estimated_delivery_date),
         status = CASE WHEN status::text = ANY(early_statuses) THEN 'ASSIGNED'::dossier_status ELSE status END,
         updated_at = now()
   WHERE id = p_dossier_id;

  RETURN jsonb_build_object('ok', true, 'dossier_id', p_dossier_id, 'departure_id', p_departure_id);
END;
$function$;

-- 2) New columns for client decision on assigned departure
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS client_departure_decision text NOT NULL DEFAULT 'pending'
    CHECK (client_departure_decision IN ('pending','confirmed','reschedule_requested','cancelled')),
  ADD COLUMN IF NOT EXISTS client_departure_decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS client_requested_pickup_date date,
  ADD COLUMN IF NOT EXISTS client_departure_note text;

-- 3) Trigger : reset to pending when admin changes departure
CREATE OR REPLACE FUNCTION public.reset_client_departure_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.assigned_departure_id IS DISTINCT FROM OLD.assigned_departure_id THEN
    NEW.client_departure_decision := 'pending';
    NEW.client_departure_decided_at := NULL;
    NEW.client_requested_pickup_date := NULL;
    NEW.client_departure_note := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_client_departure_decision ON public.dossiers;
CREATE TRIGGER trg_reset_client_departure_decision
BEFORE UPDATE OF assigned_departure_id ON public.dossiers
FOR EACH ROW EXECUTE FUNCTION public.reset_client_departure_decision();

-- 4) RPC : client decision
CREATE OR REPLACE FUNCTION public.client_decide_departure(
  p_dossier_id uuid,
  p_decision text,
  p_requested_date date DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('confirmed','reschedule_requested','cancelled') THEN
    RAISE EXCEPTION 'Decision invalide';
  END IF;

  SELECT * INTO d FROM public.dossiers WHERE id = p_dossier_id FOR UPDATE;
  IF d IS NULL THEN RAISE EXCEPTION 'Dossier introuvable'; END IF;
  IF d.user_id IS DISTINCT FROM auth.uid() AND NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  IF d.assigned_departure_id IS NULL THEN
    RAISE EXCEPTION 'Aucun depart assigne';
  END IF;

  UPDATE public.dossiers
     SET client_departure_decision = p_decision,
         client_departure_decided_at = now(),
         client_requested_pickup_date = CASE WHEN p_decision = 'reschedule_requested' THEN p_requested_date ELSE NULL END,
         client_departure_note = p_note,
         updated_at = now()
   WHERE id = p_dossier_id;

  INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client, created_by)
  VALUES (
    p_dossier_id,
    'client_departure_' || p_decision,
    jsonb_build_object(
      'decision', p_decision,
      'requested_date', p_requested_date,
      'note', p_note
    ),
    true,
    auth.uid()
  );

  RETURN jsonb_build_object('ok', true, 'decision', p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.client_decide_departure(uuid, text, date, text) TO authenticated;
