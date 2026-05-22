ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS gp_reminded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gp_reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gp_last_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS gp_no_response_alert_sent BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS last_bot_activity_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dossiers_gp_reminder
  ON public.dossiers (status, gp_reminded_at);
CREATE INDEX IF NOT EXISTS idx_dossiers_gp_alert
  ON public.dossiers (gp_no_response_alert_sent, gp_reminder_count);