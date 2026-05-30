ALTER PUBLICATION supabase_realtime ADD TABLE public.dossiers;
ALTER TABLE public.dossiers REPLICA IDENTITY FULL;