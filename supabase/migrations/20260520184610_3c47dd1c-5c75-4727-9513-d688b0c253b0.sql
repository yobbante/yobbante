
-- 1) Enum value
ALTER TYPE dossier_status ADD VALUE IF NOT EXISTS 'EN_RECHERCHE_DEPART';

-- 2) manual_departures new columns
ALTER TABLE public.manual_departures
  ADD COLUMN IF NOT EXISTS short_ref TEXT,
  ADD COLUMN IF NOT EXISTS publication_status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notes_admin TEXT,
  ADD COLUMN IF NOT EXISTS max_capacity_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS reserved_capacity_kg NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.manual_departures
  DROP CONSTRAINT IF EXISTS manual_departures_publication_status_check;
ALTER TABLE public.manual_departures
  ADD CONSTRAINT manual_departures_publication_status_check
  CHECK (publication_status IN ('draft','ready','published','closed','completed'));

-- 3) short_ref generator
CREATE OR REPLACE FUNCTION public.generate_unique_short_ref()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  candidate TEXT;
  exists_already BOOLEAN;
  attempts INT := 0;
BEGIN
  LOOP
    candidate := lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
    SELECT EXISTS(SELECT 1 FROM public.manual_departures WHERE short_ref = candidate) INTO exists_already;
    IF NOT exists_already THEN
      RETURN candidate;
    END IF;
    attempts := attempts + 1;
    IF attempts > 50 THEN
      RAISE EXCEPTION 'Impossible de générer une référence courte unique après 50 tentatives';
    END IF;
  END LOOP;
END;
$$;

-- 4) Trigger to auto-fill short_ref
CREATE OR REPLACE FUNCTION public.set_manual_departure_short_ref()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.short_ref IS NULL OR NEW.short_ref = '' THEN
    NEW.short_ref := public.generate_unique_short_ref();
  ELSE
    -- Validate manually-supplied: must be 4 digits
    IF NEW.short_ref !~ '^[0-9]{4}$' THEN
      RAISE EXCEPTION 'short_ref must be 4 digits';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_manual_departure_short_ref ON public.manual_departures;
CREATE TRIGGER trg_set_manual_departure_short_ref
  BEFORE INSERT ON public.manual_departures
  FOR EACH ROW EXECUTE FUNCTION public.set_manual_departure_short_ref();

-- 5) Backfill existing rows
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.manual_departures WHERE short_ref IS NULL OR short_ref = '' LOOP
    UPDATE public.manual_departures SET short_ref = public.generate_unique_short_ref() WHERE id = r.id;
  END LOOP;
END $$;

-- 6) Unique constraint after backfill
CREATE UNIQUE INDEX IF NOT EXISTS manual_departures_short_ref_unique
  ON public.manual_departures(short_ref);

-- 7) dossiers new columns
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS assigned_departure_id UUID REFERENCES public.manual_departures(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_transporteur_ref TEXT;

CREATE INDEX IF NOT EXISTS dossiers_assigned_departure_idx ON public.dossiers(assigned_departure_id);

-- 8) Recompute reserved_capacity_kg trigger
CREATE OR REPLACE FUNCTION public.recompute_departure_reserved_capacity(p_departure_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_departure_id IS NULL THEN RETURN; END IF;
  UPDATE public.manual_departures md
  SET reserved_capacity_kg = COALESCE((
    SELECT SUM(COALESCE(estimated_weight, 0))
    FROM public.dossiers
    WHERE assigned_departure_id = p_departure_id
      AND status NOT IN ('CANCELLED','DELIVERED')
  ), 0)
  WHERE md.id = p_departure_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_dossier_capacity_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.recompute_departure_reserved_capacity(NEW.assigned_departure_id);
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.assigned_departure_id IS DISTINCT FROM NEW.assigned_departure_id THEN
      PERFORM public.recompute_departure_reserved_capacity(OLD.assigned_departure_id);
      PERFORM public.recompute_departure_reserved_capacity(NEW.assigned_departure_id);
    ELSIF OLD.estimated_weight IS DISTINCT FROM NEW.estimated_weight OR OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM public.recompute_departure_reserved_capacity(NEW.assigned_departure_id);
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_departure_reserved_capacity(OLD.assigned_departure_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_capacity_sync ON public.dossiers;
CREATE TRIGGER trg_dossier_capacity_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_capacity_sync();
