ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_client_contact timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'dossier_status' AND e.enumlabel = 'STALE'
  ) THEN
    ALTER TYPE public.dossier_status ADD VALUE 'STALE';
  END IF;
END$$;