ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS carrier_cost_xof numeric,
  ADD COLUMN IF NOT EXISTS carrier_name text,
  ADD COLUMN IF NOT EXISTS carrier_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carrier_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS carrier_payment_method text,
  ADD COLUMN IF NOT EXISTS carrier_payment_note text;

ALTER TABLE public.fret_courses REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'fret_courses'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.fret_courses';
  END IF;
END $$;