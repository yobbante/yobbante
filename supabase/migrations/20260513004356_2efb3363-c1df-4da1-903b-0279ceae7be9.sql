ALTER TABLE public.transporteurs
ADD COLUMN IF NOT EXISTS konnekt_registered boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS konnekt_registered_at timestamptz;