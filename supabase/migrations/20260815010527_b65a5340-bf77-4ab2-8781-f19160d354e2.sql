
CREATE TYPE public.fret_course_status AS ENUM ('PENDING_ACCEPT','REMIS_CHAUFFEUR','EN_ROUTE','ARRIVE','LIVRE','ANNULE');

CREATE TABLE public.chauffeurs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telephone text NOT NULL UNIQUE,
  pin_code text NOT NULL DEFAULT lpad((floor(random()*10000))::int::text, 4, '0'),
  nom_complet text,
  immatriculation text,
  routes text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chauffeurs TO authenticated;
GRANT ALL ON public.chauffeurs TO service_role;
ALTER TABLE public.chauffeurs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage chauffeurs" ON public.chauffeurs FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.chauffeur_sessions (
  token text PRIMARY KEY,
  chauffeur_id uuid NOT NULL REFERENCES public.chauffeurs(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '30 days'
);
GRANT ALL ON public.chauffeur_sessions TO service_role;
ALTER TABLE public.chauffeur_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.fret_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref text NOT NULL UNIQUE,
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  chauffeur_id uuid REFERENCES public.chauffeurs(id) ON DELETE SET NULL,
  destination text NOT NULL,
  client_nom text,
  client_phone text,
  colis_description text,
  photo_url text,
  status public.fret_course_status NOT NULL DEFAULT 'PENDING_ACCEPT',
  confirm_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12),'hex'),
  remis_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  en_route_at timestamptz,
  arrived_at timestamptz,
  delivered_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fret_courses TO authenticated;
GRANT ALL ON public.fret_courses TO service_role;
ALTER TABLE public.fret_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff manage fret courses" ON public.fret_courses FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

CREATE TABLE public.fret_course_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid NOT NULL REFERENCES public.fret_courses(id) ON DELETE CASCADE,
  status public.fret_course_status NOT NULL,
  actor text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.fret_course_events TO authenticated;
GRANT ALL ON public.fret_course_events TO service_role;
ALTER TABLE public.fret_course_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read fret events" ON public.fret_course_events FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "staff write fret events" ON public.fret_course_events FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.fret_generate_ref()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cand text; i int := 0;
BEGIN
  LOOP
    cand := 'YBR-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.fret_courses WHERE ref = cand);
    i := i + 1;
    IF i > 50 THEN RAISE EXCEPTION 'ref generation failed'; END IF;
  END LOOP;
  RETURN cand;
END; $$;

CREATE OR REPLACE FUNCTION public.fret_courses_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ref IS NULL OR btrim(NEW.ref) = '' THEN NEW.ref := public.fret_generate_ref(); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fret_courses_defaults BEFORE INSERT OR UPDATE ON public.fret_courses
FOR EACH ROW EXECUTE FUNCTION public.fret_courses_defaults();

CREATE OR REPLACE FUNCTION public.fret_courses_log_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.fret_course_events (course_id, status) VALUES (NEW.id, NEW.status);
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trg_fret_courses_log AFTER INSERT OR UPDATE ON public.fret_courses
FOR EACH ROW EXECUTE FUNCTION public.fret_courses_log_event();

CREATE INDEX idx_fret_courses_chauffeur ON public.fret_courses(chauffeur_id, status);
CREATE INDEX idx_fret_courses_ref ON public.fret_courses(ref);
