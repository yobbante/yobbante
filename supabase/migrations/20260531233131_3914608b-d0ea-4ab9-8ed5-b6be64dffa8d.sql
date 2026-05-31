
-- 1) Trigger: block IN_TRANSIT without an assigned departure
CREATE OR REPLACE FUNCTION public.enforce_departure_before_transit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'IN_TRANSIT' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.assigned_departure_id IS NULL THEN
      RAISE EXCEPTION 'Impossible de passer en transit. Aucun depart associe a ce dossier. Assignez d''abord un depart.'
        USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_departure_before_transit ON public.dossiers;
CREATE TRIGGER trg_enforce_departure_before_transit
BEFORE UPDATE ON public.dossiers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_departure_before_transit();

-- 2) RPC: assign dossier to a specific departure (with capacity bookkeeping)
CREATE OR REPLACE FUNCTION public.assign_dossier_to_departure(
  p_dossier_id uuid,
  p_departure_id uuid,
  p_transporteur_ref text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Release prior departure if any
  IF old_dep_id IS NOT NULL AND old_dep_id <> p_departure_id THEN
    UPDATE public.manual_departures md
       SET reserved_capacity_kg = GREATEST(0, COALESCE(md.reserved_capacity_kg, 0) - weight),
           available_capacity_kg = LEAST(md.total_capacity_kg,
             md.total_capacity_kg - GREATEST(0, COALESCE(md.reserved_capacity_kg, 0) - weight)::int),
           status = CASE WHEN md.status = 'full' THEN 'active' ELSE md.status END,
           updated_at = now()
     WHERE md.id = old_dep_id;
  END IF;

  -- Reserve on new departure (only if not already reserved on it)
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
         status = CASE WHEN status = ANY(early_statuses) THEN 'ASSIGNED'::dossier_status ELSE status END,
         updated_at = now()
   WHERE id = p_dossier_id;

  RETURN jsonb_build_object('ok', true, 'dossier_id', p_dossier_id, 'departure_id', p_departure_id);
END;
$$;

-- 3) RPC: release dossier from its departure
CREATE OR REPLACE FUNCTION public.release_dossier_departure(p_dossier_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d record;
  weight numeric;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO d FROM public.dossiers WHERE id = p_dossier_id FOR UPDATE;
  IF d IS NULL OR d.assigned_departure_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'released', false);
  END IF;

  weight := COALESCE(d.actual_weight_kg, d.estimated_weight, 0);

  UPDATE public.manual_departures md
     SET reserved_capacity_kg = GREATEST(0, COALESCE(md.reserved_capacity_kg, 0) - weight),
         available_capacity_kg = LEAST(md.total_capacity_kg,
           md.total_capacity_kg - GREATEST(0, COALESCE(md.reserved_capacity_kg, 0) - weight)::int),
         status = CASE WHEN md.status = 'full' THEN 'active' ELSE md.status END,
         updated_at = now()
   WHERE md.id = d.assigned_departure_id;

  UPDATE public.dossiers
     SET assigned_departure_id = NULL
   WHERE id = p_dossier_id;

  RETURN jsonb_build_object('ok', true, 'released', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_dossier_to_departure(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_dossier_departure(uuid) TO authenticated;
