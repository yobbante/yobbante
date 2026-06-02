ALTER TABLE public.dossiers
ADD COLUMN IF NOT EXISTS weight_alert_sent_at timestamp with time zone;