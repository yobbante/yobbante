
CREATE TABLE public.konnekt_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  status text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  partner_authenticated boolean NOT NULL DEFAULT false,
  raw_payload jsonb,
  error_message text
);

CREATE INDEX idx_konnekt_sync_log_created_at ON public.konnekt_sync_log (created_at DESC);

ALTER TABLE public.konnekt_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read sync log"
  ON public.konnekt_sync_log
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE TABLE public.konnekt_departures_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL,
  count integer NOT NULL DEFAULT 0,
  departures jsonb NOT NULL DEFAULT '[]'::jsonb
);

ALTER TABLE public.konnekt_departures_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read departures cache"
  ON public.konnekt_departures_cache
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));
