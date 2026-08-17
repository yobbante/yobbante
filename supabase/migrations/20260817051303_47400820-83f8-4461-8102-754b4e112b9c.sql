
CREATE OR REPLACE FUNCTION public.generate_devis_reference()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE ref text; ok boolean;
BEGIN
  LOOP
    ref := 'DEV-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));
    SELECT NOT EXISTS(SELECT 1 FROM public.devis d WHERE d.reference = ref) INTO ok;
    EXIT WHEN ok;
  END LOOP;
  RETURN ref;
END; $$ SET search_path = public;

CREATE TABLE public.devis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  parent_id uuid REFERENCES public.devis(id) ON DELETE SET NULL,
  is_current boolean NOT NULL DEFAULT true,
  dossier_id uuid REFERENCES public.dossiers(id) ON DELETE SET NULL,
  conversation_phone text,
  engine text NOT NULL DEFAULT 'international',
  origin text,
  destination text,
  weight_kg numeric,
  colis_size text,
  mode text,
  breakdown jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_fcfa integer NOT NULL DEFAULT 0,
  total_manual boolean NOT NULL DEFAULT false,
  notes text,
  status text NOT NULL DEFAULT 'pending_send',
  valid_until date NOT NULL DEFAULT (now() + interval '7 days')::date,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT devis_status_chk CHECK (status IN ('pending_send','sent','accepted','expired','cancelled')),
  CONSTRAINT devis_engine_chk CHECK (engine IN ('international','fret_national','fret_international')),
  CONSTRAINT devis_ref_version_uniq UNIQUE (reference, version)
);

ALTER TABLE public.devis ALTER COLUMN reference SET DEFAULT public.generate_devis_reference();

CREATE INDEX devis_dossier_idx ON public.devis(dossier_id);
CREATE INDEX devis_phone_idx ON public.devis(conversation_phone);
CREATE INDEX devis_status_idx ON public.devis(status);

GRANT SELECT, INSERT, UPDATE ON public.devis TO authenticated;
GRANT INSERT ON public.devis TO anon;
GRANT ALL ON public.devis TO service_role;

ALTER TABLE public.devis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage devis" ON public.devis
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.is_agent_support(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()) OR public.is_agent_support(auth.uid()));

CREATE POLICY "Anyone can create an auto devis" ON public.devis
  FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending_send' AND total_manual = false);

CREATE TRIGGER devis_touch BEFORE UPDATE ON public.devis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
