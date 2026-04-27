-- Status enum for manual quote requests
DO $$ BEGIN
  CREATE TYPE public.manual_quote_status AS ENUM ('pending', 'quoted', 'confirmed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.manual_quote_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  origin_country text,
  origin_city text NOT NULL,
  destination_country text,
  destination_city text NOT NULL,
  weight_kg numeric NOT NULL,
  transport_mode text,
  priority text,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  note text,
  status public.manual_quote_status NOT NULL DEFAULT 'pending',
  source text NOT NULL DEFAULT 'send_flow',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.manual_quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit manual quote"
  ON public.manual_quote_requests FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Users view own manual quotes"
  ON public.manual_quote_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_staff(auth.uid()));

CREATE POLICY "Staff update manual quotes"
  ON public.manual_quote_requests FOR UPDATE
  TO authenticated
  USING (is_staff(auth.uid()));

CREATE TRIGGER manual_quote_requests_updated_at
  BEFORE UPDATE ON public.manual_quote_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_manual_quote_status ON public.manual_quote_requests(status, created_at DESC);
CREATE INDEX idx_manual_quote_user ON public.manual_quote_requests(user_id);