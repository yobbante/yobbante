DO $mig$
DECLARE src text;
BEGIN
  SELECT p.prosrc INTO src FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='trg_dossier_whatsapp_notify';
  src := replace(src, 'NEW.service_type', 'NEW.transport_mode');
  EXECUTE 'CREATE OR REPLACE FUNCTION public.trg_dossier_whatsapp_notify() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $f$' || src || '$f$';
END
$mig$;