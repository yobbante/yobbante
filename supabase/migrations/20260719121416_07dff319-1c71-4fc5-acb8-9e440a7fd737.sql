ALTER POLICY "Business members insert dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Business members update dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Business members view dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Staff update all dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Staff view all dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Users can insert own dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Users can update own dossiers" ON public.dossiers TO authenticated;
ALTER POLICY "Users can view own dossiers" ON public.dossiers TO authenticated;

DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT polname FROM pg_policy WHERE polrelid='public.custom_cities'::regclass LOOP
    EXECUTE format('ALTER POLICY %I ON public.custom_cities TO authenticated', p.polname);
  END LOOP;
END$$;

CREATE POLICY "Anon read active custom cities" ON public.custom_cities FOR SELECT TO anon USING (COALESCE(active, true) = true);
GRANT SELECT ON public.custom_cities TO anon;