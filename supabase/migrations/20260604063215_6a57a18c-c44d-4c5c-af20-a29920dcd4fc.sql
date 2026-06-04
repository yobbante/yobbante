-- Relax NOT NULL constraints so GPs can be imported with missing fields (no fabricated values)
ALTER TABLE public.transporteurs ALTER COLUMN reference DROP NOT NULL;
ALTER TABLE public.transporteurs ALTER COLUMN nom DROP NOT NULL;
ALTER TABLE public.transporteurs ALTER COLUMN adresse_1 DROP NOT NULL;
ALTER TABLE public.transporteurs ALTER COLUMN ville DROP NOT NULL;

-- Allow reference to be NULL but if present must be 4 digits (already enforced via CHECK on format)
-- Replace CHECK to allow NULL explicitly
ALTER TABLE public.transporteurs DROP CONSTRAINT IF EXISTS transporteurs_reference_format;
ALTER TABLE public.transporteurs ADD CONSTRAINT transporteurs_reference_format
  CHECK (reference IS NULL OR reference ~ '^[0-9]{4}$');

-- Unique constraint already allows multiple NULLs by default in Postgres