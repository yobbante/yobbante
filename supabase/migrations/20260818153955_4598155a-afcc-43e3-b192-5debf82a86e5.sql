CREATE UNIQUE INDEX IF NOT EXISTS devis_reference_v1_uniq ON public.devis(reference) WHERE version = 1;

CREATE OR REPLACE FUNCTION public.generate_devis_reference()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE ref text; ok boolean; tries int := 0;
BEGIN
  LOOP
    tries := tries + 1;
    ref := 'DEV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8));
    SELECT NOT EXISTS(SELECT 1 FROM public.devis d WHERE d.reference = ref) INTO ok;
    EXIT WHEN ok OR tries > 20;
  END LOOP;
  RETURN ref;
END; $$ SET search_path = public;