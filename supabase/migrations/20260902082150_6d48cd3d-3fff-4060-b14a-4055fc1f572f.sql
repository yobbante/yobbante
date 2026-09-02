-- Helper rôle
CREATE OR REPLACE FUNCTION public.is_stagiaire_partenariats(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'stagiaire_partenariats')
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin','staff','agent_support','agent_terrain'))
$$;
REVOKE EXECUTE ON FUNCTION public.is_stagiaire_partenariats(uuid) FROM anon;

-- Tables
CREATE TABLE IF NOT EXISTS public.internal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  due_date date,
  priority text NOT NULL DEFAULT 'normale',
  status text NOT NULL DEFAULT 'a_faire',
  assignee_id uuid,
  created_by uuid,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_tasks TO authenticated;
GRANT ALL ON public.internal_tasks TO service_role;
ALTER TABLE public.internal_tasks ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.internal_task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.internal_tasks(id) ON DELETE CASCADE,
  author_id uuid,
  author_label text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.internal_task_comments TO authenticated;
GRANT ALL ON public.internal_task_comments TO service_role;
ALTER TABLE public.internal_task_comments ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.partenaires_logistique (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chantier text NOT NULL DEFAULT 'aerien',
  zone_code text,
  zone_label text,
  ville text,
  nom text NOT NULL,
  contact text,
  specialite text,
  statut text NOT NULL DEFAULT 'a_contacter',
  tarif_obtenu text,
  tarif_montant numeric,
  devise text DEFAULT 'XOF',
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.partenaires_logistique TO authenticated;
GRANT ALL ON public.partenaires_logistique TO service_role;
ALTER TABLE public.partenaires_logistique ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.staff_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_activity_log_created_idx ON public.staff_activity_log (created_at DESC);
GRANT SELECT, INSERT ON public.staff_activity_log TO authenticated;
GRANT ALL ON public.staff_activity_log TO service_role;
ALTER TABLE public.staff_activity_log ENABLE ROW LEVEL SECURITY;

-- Policies permissives
DROP POLICY IF EXISTS "staff manage tasks" ON public.internal_tasks;
CREATE POLICY "staff manage tasks" ON public.internal_tasks FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR assignee_id = auth.uid())
  WITH CHECK (public.is_staff(auth.uid()) OR assignee_id = auth.uid());

DROP POLICY IF EXISTS "stagiaire reads own tasks" ON public.internal_tasks;
CREATE POLICY "stagiaire reads own tasks" ON public.internal_tasks FOR SELECT TO authenticated
  USING (assignee_id = auth.uid());

DROP POLICY IF EXISTS "task comments visible" ON public.internal_task_comments;
CREATE POLICY "task comments visible" ON public.internal_task_comments FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.internal_tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid()));

DROP POLICY IF EXISTS "task comments insert" ON public.internal_task_comments;
CREATE POLICY "task comments insert" ON public.internal_task_comments FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND (public.is_staff(auth.uid()) OR EXISTS (
    SELECT 1 FROM public.internal_tasks t WHERE t.id = task_id AND t.assignee_id = auth.uid())));

DROP POLICY IF EXISTS "partners staff manage" ON public.partenaires_logistique;
CREATE POLICY "partners staff manage" ON public.partenaires_logistique FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_stagiaire_partenariats(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()) OR public.is_stagiaire_partenariats(auth.uid()));

DROP POLICY IF EXISTS "activity readable by staff" ON public.staff_activity_log;
CREATE POLICY "activity readable by staff" ON public.staff_activity_log FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "activity insert self" ON public.staff_activity_log;
CREATE POLICY "activity insert self" ON public.staff_activity_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Verrouillage du rôle stagiaire : tout est interdit sauf whitelist
DO $$
DECLARE
  t text;
  rw text[] := ARRAY['partenaires_logistique','internal_task_comments','internal_tasks','staff_activity_log'];
  ro text[] := ARRAY['transporteurs','profiles','user_roles'];
BEGIN
  FOR t IN
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Stagiaire blocked" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Stagiaire read only" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "Stagiaire cannot delete" ON public.%I', t);
    IF t = ANY(rw) THEN
      EXECUTE format('CREATE POLICY "Stagiaire cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_stagiaire_partenariats(auth.uid()))', t);
    ELSIF t = ANY(ro) THEN
      EXECUTE format('CREATE POLICY "Stagiaire read only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (true) WITH CHECK (NOT public.is_stagiaire_partenariats(auth.uid()))', t);
    ELSE
      EXECUTE format('CREATE POLICY "Stagiaire blocked" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_stagiaire_partenariats(auth.uid())) WITH CHECK (NOT public.is_stagiaire_partenariats(auth.uid()))', t);
    END IF;
  END LOOP;
END $$;

-- Les nouvelles tables doivent aussi rester interdites aux agents terrain
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['internal_tasks','internal_task_comments','partenaires_logistique','staff_activity_log'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Terrain agents blocked" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Terrain agents blocked" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_agent_terrain(auth.uid())) WITH CHECK (NOT public.is_agent_terrain(auth.uid()))', t);
  END LOOP;
END $$;

-- Journalisation automatique
CREATE OR REPLACE FUNCTION public.log_internal_activity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_action text;
  v_label text;
BEGIN
  IF TG_TABLE_NAME = 'internal_tasks' THEN
    IF TG_OP = 'INSERT' THEN v_action := 'task_created'; v_label := NEW.title;
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      v_action := CASE WHEN NEW.status = 'termine' THEN 'task_completed' ELSE 'task_status_changed' END;
      v_label := NEW.title || ' → ' || NEW.status;
    ELSE v_action := 'task_updated'; v_label := NEW.title;
    END IF;
  ELSIF TG_TABLE_NAME = 'partenaires_logistique' THEN
    v_action := CASE WHEN TG_OP = 'INSERT' THEN 'partner_created' ELSE 'partner_updated' END;
    v_label := NEW.nom || ' (' || NEW.chantier || COALESCE(' · ' || NEW.zone_label, '') || ')';
  ELSE
    v_action := 'task_comment';
    v_label := left(NEW.body, 120);
  END IF;

  INSERT INTO public.staff_activity_log (user_id, action, entity_type, entity_id, label)
  VALUES (COALESCE(auth.uid(), NEW.created_by), v_action, TG_TABLE_NAME,
          CASE WHEN TG_TABLE_NAME = 'internal_task_comments' THEN NEW.task_id ELSE NEW.id END, v_label);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_log_tasks ON public.internal_tasks;
CREATE TRIGGER trg_log_tasks AFTER INSERT OR UPDATE ON public.internal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.log_internal_activity();
DROP TRIGGER IF EXISTS trg_log_partners ON public.partenaires_logistique;
CREATE TRIGGER trg_log_partners AFTER INSERT OR UPDATE ON public.partenaires_logistique
  FOR EACH ROW EXECUTE FUNCTION public.log_internal_activity();
DROP TRIGGER IF EXISTS trg_log_comments ON public.internal_task_comments;
CREATE TRIGGER trg_log_comments AFTER INSERT ON public.internal_task_comments
  FOR EACH ROW EXECUTE FUNCTION public.log_internal_activity();

CREATE OR REPLACE FUNCTION public.touch_internal_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_TABLE_NAME = 'internal_tasks' AND NEW.status = 'termine' AND OLD.status IS DISTINCT FROM 'termine' THEN
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_touch_tasks ON public.internal_tasks;
CREATE TRIGGER trg_touch_tasks BEFORE UPDATE ON public.internal_tasks
  FOR EACH ROW EXECUTE FUNCTION public.touch_internal_updated_at();
DROP TRIGGER IF EXISTS trg_touch_partners ON public.partenaires_logistique;
CREATE TRIGGER trg_touch_partners BEFORE UPDATE ON public.partenaires_logistique
  FOR EACH ROW EXECUTE FUNCTION public.touch_internal_updated_at();

-- Vue d'activité (aucune donnée financière)
CREATE OR REPLACE FUNCTION public.get_internal_activity_overview()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE res jsonb;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.is_stagiaire_partenariats(auth.uid())) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'dossiers_by_mode', COALESCE((
      SELECT jsonb_object_agg(mode, n) FROM (
        SELECT COALESCE(transport_mode, 'gp') AS mode, count(*) AS n
        FROM public.dossiers
        WHERE status::text NOT IN ('DELIVERED','ARCHIVED','CANCELLED','CLOSED')
        GROUP BY 1) s), '{}'::jsonb),
    'fret_by_status', COALESCE((
      SELECT jsonb_object_agg(status, n) FROM (
        SELECT status::text AS status, count(*) AS n FROM public.fret_courses
        WHERE status::text NOT IN ('LIVRE','ANNULE') GROUP BY 1) s2), '{}'::jsonb),
    'gp_actifs', (SELECT count(*) FROM public.transporteurs WHERE actif IS TRUE),
    'gp_total', (SELECT count(*) FROM public.transporteurs)
  ) INTO res;
  RETURN res;
END $$;
REVOKE EXECUTE ON FUNCTION public.get_internal_activity_overview() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_internal_activity_overview() TO authenticated;

-- Rapport hebdomadaire vendredi 16h
DO $$
DECLARE jid bigint;
BEGIN
  SELECT jobid INTO jid FROM cron.job WHERE jobname = 'intern-weekly-report';
  IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
END $$;
SELECT cron.schedule(
  'intern-weekly-report',
  '0 16 * * 5',
  $$
  SELECT net.http_post(
    url := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/cron-intern-weekly',
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := '{}'::jsonb
  );
  $$
);