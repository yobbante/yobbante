-- 1. Nouveau rôle
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent_terrain';

-- 2. Helper : agent terrain (et rien d'autre)
CREATE OR REPLACE FUNCTION public.is_agent_terrain(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'agent_terrain'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'staff', 'agent_support')
  )
$$;

-- 3. Il compte comme staff pour les tables opérationnelles partagées
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'staff', 'agent_support', 'agent_terrain')
  )
$$;

-- 4. Verrouillage global : tout est interdit sauf la whitelist fret
DO $$
DECLARE
  t text;
  full_access text[] := ARRAY['fret_courses','fret_course_events','chauffeurs'];
  read_only   text[] := ARRAY['fret_tarif_zones','fret_tarif_destinations','devis',
                              'custom_cities','user_roles','profiles'];
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Terrain agents blocked" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Terrain agents read only" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Terrain agents cannot delete" ON public.%I', t);

    IF t = ANY(full_access) THEN
      EXECUTE format(
        'CREATE POLICY "Terrain agents cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_agent_terrain(auth.uid()))', t);
    ELSIF t = ANY(read_only) THEN
      EXECUTE format(
        'CREATE POLICY "Terrain agents read only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (true) WITH CHECK (NOT public.is_agent_terrain(auth.uid()))', t);
      EXECUTE format(
        'CREATE POLICY "Terrain agents cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_agent_terrain(auth.uid()))', t);
    ELSE
      EXECUTE format(
        'CREATE POLICY "Terrain agents blocked" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_agent_terrain(auth.uid())) WITH CHECK (NOT public.is_agent_terrain(auth.uid()))', t);
    END IF;
  END LOOP;
END $$;

-- 5. Devis : uniquement les devis Terminal D (routier) pour l'agent terrain
DROP POLICY IF EXISTS "Terrain agents see only fret devis" ON public.devis;
CREATE POLICY "Terrain agents see only fret devis" ON public.devis
  AS RESTRICTIVE FOR ALL TO authenticated
  USING (
    NOT public.is_agent_terrain(auth.uid())
    OR engine IN ('fret_national','fret_international')
  );