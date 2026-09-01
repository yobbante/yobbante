ALTER TABLE public.fret_courses
  ADD COLUMN IF NOT EXISTS chauffeur_cost_fcfa numeric,
  ADD COLUMN IF NOT EXISTS chauffeur_paid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chauffeur_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS chauffeur_payment_method text;