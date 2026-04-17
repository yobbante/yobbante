
-- Enum for quote lifecycle
CREATE TYPE public.enterprise_quote_status AS ENUM ('NEW','CONTACTED','QUALIFIED','WON','LOST');

CREATE TABLE public.enterprise_quotes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  sector TEXT NOT NULL,
  volume TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  notes TEXT,
  status public.enterprise_quote_status NOT NULL DEFAULT 'NEW',
  source TEXT NOT NULL DEFAULT 'devis-entreprise',
  admin_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_enterprise_quotes_created_at ON public.enterprise_quotes (created_at DESC);
CREATE INDEX idx_enterprise_quotes_status ON public.enterprise_quotes (status);

ALTER TABLE public.enterprise_quotes ENABLE ROW LEVEL SECURITY;

-- Public can submit a quote (anonymous)
CREATE POLICY "Anyone can submit enterprise quote"
ON public.enterprise_quotes
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- Staff read all
CREATE POLICY "Staff view all enterprise quotes"
ON public.enterprise_quotes
FOR SELECT
TO authenticated
USING (public.is_staff(auth.uid()));

-- Staff update
CREATE POLICY "Staff update enterprise quotes"
ON public.enterprise_quotes
FOR UPDATE
TO authenticated
USING (public.is_staff(auth.uid()));

-- Auto updated_at
CREATE TRIGGER set_enterprise_quotes_updated_at
BEFORE UPDATE ON public.enterprise_quotes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
