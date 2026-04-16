-- Add new warehouse countries to enum
ALTER TYPE warehouse_country ADD VALUE IF NOT EXISTS 'CA';
ALTER TYPE warehouse_country ADD VALUE IF NOT EXISTS 'AE';
ALTER TYPE warehouse_country ADD VALUE IF NOT EXISTS 'DE';

-- Dossier status enum
CREATE TYPE dossier_status AS ENUM (
  'SUBMITTED','IN_REVIEW','SOURCING','PROCURED',
  'IN_TRANSIT','CUSTOMS','DELIVERED','CLOSED'
);

-- Reference generator
CREATE OR REPLACE FUNCTION public.generate_dossier_reference()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  rnd text := lpad((floor(random() * 10000))::int::text, 4, '0');
BEGIN
  RETURN 'YBT-' || yr || '-' || rnd;
END;
$$;

-- Dossiers table
CREATE TABLE public.dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  reference text NOT NULL DEFAULT generate_dossier_reference(),
  status dossier_status NOT NULL DEFAULT 'SUBMITTED',
  product_description text NOT NULL,
  estimated_weight numeric,
  origin_country warehouse_country NOT NULL,
  destination_country text NOT NULL DEFAULT 'SN',
  budget_eur numeric,
  needs_sourcing boolean NOT NULL DEFAULT false,
  contact_phone text,
  contact_email text,
  notes text,
  estimated_cost numeric,
  estimated_delivery_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dossiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dossiers"
ON public.dossiers FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dossiers"
ON public.dossiers FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dossiers"
ON public.dossiers FOR UPDATE
USING (auth.uid() = user_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_dossiers_updated_at
BEFORE UPDATE ON public.dossiers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();