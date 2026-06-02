-- Grant authenticated read on dossier_events so RLS policies actually work via PostgREST
GRANT SELECT ON public.dossier_events TO authenticated;
GRANT ALL ON public.dossier_events TO service_role;

-- Add dossier_events to realtime + ensure REPLICA IDENTITY FULL for full payloads
ALTER TABLE public.dossier_events REPLICA IDENTITY FULL;
ALTER TABLE public.dossiers REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'dossier_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.dossier_events;
  END IF;
END $$;