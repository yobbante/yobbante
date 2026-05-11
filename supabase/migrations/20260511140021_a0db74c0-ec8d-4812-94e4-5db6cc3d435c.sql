CREATE OR REPLACE FUNCTION public.expire_past_manual_departures()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n int;
BEGIN
  WITH upd AS (
    UPDATE public.manual_departures
       SET status = 'expired', updated_at = now()
     WHERE status IN ('active','draft')
       AND departure_date < current_date - interval '1 day'
     RETURNING id
  ) SELECT count(*) INTO n FROM upd;
  RETURN n;
END;
$function$;