
CREATE OR REPLACE FUNCTION public.get_assigned_departure_public(p_tracking text)
RETURNS TABLE(
  dossier_id uuid,
  tracking_id text,
  reference text,
  status dossier_status,
  assigned_departure_id uuid,
  client_departure_decision text,
  client_departure_decided_at timestamptz,
  client_departure_note text,
  origin_city text,
  destination_city text,
  departure_date date,
  short_ref text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    d.id, d.tracking_id, d.reference, d.status,
    d.assigned_departure_id,
    d.client_departure_decision,
    d.client_departure_decided_at,
    d.client_departure_note,
    md.origin_city, md.destination_city, md.departure_date, md.short_ref
  FROM public.dossiers d
  LEFT JOIN public.manual_departures md ON md.id = d.assigned_departure_id
  WHERE d.tracking_id = p_tracking OR d.reference = p_tracking
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_assigned_departure_public(text) TO anon, authenticated;
