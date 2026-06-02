CREATE TABLE IF NOT EXISTS public.waitlist_departures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  origin text NOT NULL DEFAULT 'Dakar',
  destination text NOT NULL,
  client_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz,
  source text DEFAULT 'bot_client'
);

CREATE INDEX IF NOT EXISTS waitlist_departures_destination_idx ON public.waitlist_departures(destination);
CREATE INDEX IF NOT EXISTS waitlist_departures_phone_idx ON public.waitlist_departures(phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.waitlist_departures TO authenticated;
GRANT ALL ON public.waitlist_departures TO service_role;

ALTER TABLE public.waitlist_departures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage waitlist" ON public.waitlist_departures
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
