
ALTER TABLE public.dossier_messages
  ALTER COLUMN author_id DROP NOT NULL;

ALTER TABLE public.dossier_messages
  ADD COLUMN IF NOT EXISTS source text;
