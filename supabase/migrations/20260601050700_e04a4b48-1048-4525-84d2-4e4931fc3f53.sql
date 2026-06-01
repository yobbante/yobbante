-- 1) Add new dossier status: DEPARTURE_CONFIRMED
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'dossier_status' AND e.enumlabel = 'DEPARTURE_CONFIRMED'
  ) THEN
    ALTER TYPE public.dossier_status ADD VALUE 'DEPARTURE_CONFIRMED';
  END IF;
END $$;

-- 2) Update client_decide_departure: set dossier status to DEPARTURE_CONFIRMED when client confirms
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
         status = CASE
           WHEN p_decision = 'confirmed' AND status::text IN ('SUBMITTED','AWAITING_CLIENT','CONFIRMED','ASSIGNED')
             THEN 'DEPARTURE_CONFIRMED'::dossier_status
           ELSE status
         END,
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