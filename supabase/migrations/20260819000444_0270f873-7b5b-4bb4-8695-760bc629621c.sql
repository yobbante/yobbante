ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS capacite_kg numeric DEFAULT 25;