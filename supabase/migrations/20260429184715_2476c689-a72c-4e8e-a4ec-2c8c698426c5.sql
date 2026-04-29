-- Make tracking number generator run with definer privileges so the
-- BEFORE INSERT trigger can access the underlying sequence regardless
-- of the calling user's grants.
CREATE OR REPLACE FUNCTION public.generate_shipment_tracking_number()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  yr text := to_char(now(), 'YYYY');
  n  bigint := nextval('public.shipment_tracking_seq');
BEGIN
  RETURN 'YOB-' || yr || '-' || lpad((n % 100000)::text, 5, '0');
END;
$function$;

-- Make the trigger function security definer too (it calls the generator
-- and assigns to NEW.tracking_number on insert).
CREATE OR REPLACE FUNCTION public.set_shipment_tracking_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tracking_number IS NULL OR length(NEW.tracking_number) = 0 THEN
    NEW.tracking_number := public.generate_shipment_tracking_number();
  END IF;
  RETURN NEW;
END;
$function$;

-- Belt-and-suspenders: grant execute + sequence usage to authenticated.
GRANT EXECUTE ON FUNCTION public.generate_shipment_tracking_number() TO authenticated, anon, service_role;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.shipment_tracking_seq TO authenticated, service_role;
