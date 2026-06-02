ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS mission_accepted boolean,
  ADD COLUMN IF NOT EXISTS mission_decided_at timestamptz;

ALTER TABLE public.manual_departures
  ADD COLUMN IF NOT EXISTS departure_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS departure_confirmed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_dossiers_gp_mission_pending
  ON public.dossiers (assigned_transporteur_ref, status)
  WHERE mission_accepted IS NULL AND status = 'ASSIGNED';