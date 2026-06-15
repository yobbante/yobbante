ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS gp_acceptance_alert_sent_at timestamptz;

COMMENT ON COLUMN public.dossiers.gp_acceptance_alert_sent_at IS
  'Dernière alerte admin envoyée parce que le GP assigné n''a pas accepté sa mission. Sert à throttler l''alerte récurrente du cron mission-lifecycle.';