-- Status enum
DO $$ BEGIN
  CREATE TYPE public.business_account_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Main table
CREATE TABLE IF NOT EXISTS public.business_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ninea TEXT NOT NULL UNIQUE,
  legal_name TEXT NOT NULL,
  legal_form TEXT NOT NULL,
  sector TEXT NOT NULL,
  headquarters_address TEXT NOT NULL,
  website TEXT,
  admin_full_name TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  admin_phone TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  status public.business_account_status NOT NULL DEFAULT 'pending',
  activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.business_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own business account"
  ON public.business_accounts FOR SELECT
  USING (auth.uid() = user_id OR public.is_staff(auth.uid()));

CREATE POLICY "Users insert own business account"
  ON public.business_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own business account"
  ON public.business_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Staff manage business accounts"
  ON public.business_accounts FOR ALL
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE TRIGGER trg_business_accounts_updated_at
  BEFORE UPDATE ON public.business_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_business_accounts_user_id ON public.business_accounts(user_id);
CREATE INDEX idx_business_accounts_status ON public.business_accounts(status);