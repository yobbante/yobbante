
-- Audit: flag inconsistent DEPARTURE_CONFIRMED dossiers
CREATE OR REPLACE FUNCTION public.audit_departure_confirmed_inconsistencies()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_issue text;
  v_count int := 0;
  v_label text;
BEGIN
  FOR r IN
    SELECT d.id, d.tracking_id, d.reference,
           d.assigned_departure_id, d.assigned_transporteur_ref,
           md.departure_date
      FROM public.dossiers d
      LEFT JOIN public.manual_departures md ON md.id = d.assigned_departure_id
     WHERE d.status = 'DEPARTURE_CONFIRMED'
  LOOP
    v_issue := NULL;
    IF r.assigned_transporteur_ref IS NULL THEN
      v_issue := 'GP manquant';
    ELSIF r.assigned_departure_id IS NULL THEN
      v_issue := 'Départ manquant';
    ELSIF r.departure_date IS NULL THEN
      v_issue := 'Date de départ manquante';
    END IF;

    IF v_issue IS NOT NULL THEN
      v_label := COALESCE(r.tracking_id, r.reference, r.id::text);
      -- Avoid duplicate open notifications for same dossier+issue in last 24h
      IF NOT EXISTS (
        SELECT 1 FROM public.admin_notifications an
         WHERE an.dossier_id = r.id
           AND an.event_type = 'departure_confirmed_inconsistency'
           AND an.payload->>'issue' = v_issue
           AND an.created_at > now() - interval '24 hours'
      ) THEN
        PERFORM public.enqueue_admin_notification(
          'departure_confirmed_inconsistency',
          '⚠️ ' || v_label || ' marqué Départ confirmé mais : ' || v_issue,
          r.id,
          jsonb_build_object('issue', v_issue)
        );
        v_count := v_count + 1;
      END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.audit_departure_confirmed_inconsistencies() TO authenticated, service_role;
