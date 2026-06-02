CREATE UNIQUE INDEX IF NOT EXISTS dossier_messages_source_unique
  ON public.dossier_messages (source)
  WHERE source IS NOT NULL;