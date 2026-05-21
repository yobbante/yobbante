CREATE OR REPLACE FUNCTION public.generate_tracking_id_v2()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT;
  candidate TEXT;
  attempts INT := 0;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..6 LOOP
      result := result || substring(chars FROM (1 + floor(random() * length(chars)))::int FOR 1);
    END LOOP;
    candidate := 'YOB-' || result;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.dossiers WHERE tracking_id = candidate);
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Could not generate unique tracking id';
    END IF;
  END LOOP;
  RETURN candidate;
END;
$$;