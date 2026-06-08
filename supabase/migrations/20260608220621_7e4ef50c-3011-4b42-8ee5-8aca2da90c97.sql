ALTER TABLE public.manual_departures
  ADD COLUMN IF NOT EXISTS reminder_j3_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_j0_sent_at timestamptz;

ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS collect_reminder_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS weight_reminder_sent_at timestamptz;