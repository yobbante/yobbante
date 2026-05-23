ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS is_gift boolean NOT NULL DEFAULT false;