CREATE OR REPLACE FUNCTION public.manual_departures_auto_full()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Les départs maritimes se mesurent en CBM : ne pas les marquer « complet »
  -- quand seule la capacité en kg est absente.
  IF NEW.status = 'active'
     AND NEW.available_capacity_kg <= 0
     AND COALESCE(NEW.capacity_cbm, 0) <= 0 THEN
    NEW.status := 'full';
  END IF;
  RETURN NEW;
END;
$function$;