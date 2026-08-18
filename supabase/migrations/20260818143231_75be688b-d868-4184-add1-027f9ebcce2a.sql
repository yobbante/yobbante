ALTER TYPE fret_course_status ADD VALUE IF NOT EXISTS 'A_ENLEVER' BEFORE 'PENDING_ACCEPT';

ALTER TABLE public.fret_courses
  ADD COLUMN IF NOT EXISTS pickup_address text,
  ADD COLUMN IF NOT EXISTS pickup_zone text,
  ADD COLUMN IF NOT EXISTS pickup_fee_fcfa integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS expediteur_nom text,
  ADD COLUMN IF NOT EXISTS expediteur_phone text,
  ADD COLUMN IF NOT EXISTS colis_size text,
  ADD COLUMN IF NOT EXISTS weight_kg numeric,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS total_fcfa integer,
  ADD COLUMN IF NOT EXISTS source text;

ALTER TABLE public.fret_courses ALTER COLUMN chauffeur_id DROP NOT NULL;
ALTER TABLE public.fret_courses ALTER COLUMN remis_at DROP NOT NULL;
ALTER TABLE public.fret_courses ALTER COLUMN remis_at DROP DEFAULT;