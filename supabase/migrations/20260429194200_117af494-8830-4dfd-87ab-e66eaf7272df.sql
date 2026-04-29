DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sourcing_profile') THEN
    CREATE TYPE public.sourcing_profile AS ENUM ('individual', 'business');
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sourcing_profile public.sourcing_profile;