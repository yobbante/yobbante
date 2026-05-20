
-- 1) Extend dossier_status enum
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'AWAITING_CLIENT';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'CONFIRMED';

-- 2) Add columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'site_web',
  ADD COLUMN IF NOT EXISTS source_reference TEXT,
  ADD COLUMN IF NOT EXISTS intake_notes TEXT,
  ADD COLUMN IF NOT EXISTS intake_by UUID,
  ADD COLUMN IF NOT EXISTS intake_method TEXT NOT NULL DEFAULT 'self_service';

DO $$ BEGIN
  ALTER TABLE public.dossiers
    ADD CONSTRAINT dossiers_source_check
    CHECK (source IN ('site_web','whatsapp','telephone','email','instagram','facebook','walk_in','referral','autre'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.dossiers
    ADD CONSTRAINT dossiers_intake_method_check
    CHECK (intake_method IN ('self_service','manual_intake'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_dossiers_source ON public.dossiers(source);
CREATE INDEX IF NOT EXISTS idx_dossiers_intake_by ON public.dossiers(intake_by);

-- 3) legacy_dossiers table
CREATE TABLE IF NOT EXISTS public.legacy_dossiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id TEXT,
  client_name TEXT,
  client_phone TEXT,
  client_email TEXT,
  type TEXT,
  origin TEXT,
  destination TEXT,
  weight_kg NUMERIC,
  description TEXT,
  status_legacy TEXT,
  amount NUMERIC,
  currency TEXT DEFAULT 'XOF',
  source TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_to_dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL
);

ALTER TABLE public.legacy_dossiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage legacy dossiers" ON public.legacy_dossiers;
CREATE POLICY "Staff manage legacy dossiers"
  ON public.legacy_dossiers
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- 4) intake_drafts table
CREATE TABLE IF NOT EXISTS public.intake_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  draft_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intake_drafts_user ON public.intake_drafts(user_id);

ALTER TABLE public.intake_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own intake drafts" ON public.intake_drafts;
CREATE POLICY "Users manage own intake drafts"
  ON public.intake_drafts
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_intake_drafts_updated_at ON public.intake_drafts;
CREATE TRIGGER trg_intake_drafts_updated_at
  BEFORE UPDATE ON public.intake_drafts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
