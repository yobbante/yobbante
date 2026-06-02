DROP FUNCTION IF EXISTS public.lookup_dossier_public(text);
CREATE FUNCTION public.lookup_dossier_public(p_tracking text)
 RETURNS TABLE(
   tracking_id text, reference text, status dossier_status, payment_status text,
   origin_country text, destination_country text,
   origin_city text, destination_city text,
   estimated_weight numeric, estimated_delivery_date date, estimated_cost numeric,
   actual_weight_kg numeric, final_amount_xof numeric, cash_on_delivery boolean,
   assigned_transporteur_ref text, weighed_at timestamptz, paid_at timestamptz,
   created_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    d.tracking_id, d.reference, d.status, d.payment_status,
    d.origin_country::text, d.destination_country,
    d.origin_city, d.destination_city,
    d.estimated_weight, d.estimated_delivery_date, d.estimated_cost,
    d.actual_weight_kg, d.final_amount_xof, d.cash_on_delivery,
    d.assigned_transporteur_ref, d.weighed_at, d.paid_at,
    d.created_at
  FROM public.dossiers d
  WHERE d.tracking_id = p_tracking OR d.reference = p_tracking
  LIMIT 1;
$function$;
GRANT EXECUTE ON FUNCTION public.lookup_dossier_public(text) TO anon, authenticated;