
-- 1) gp_bot_sessions : conversation guidée du bot
CREATE TABLE IF NOT EXISTS public.gp_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_id UUID REFERENCES public.transporteurs(id) ON DELETE CASCADE,
  from_phone TEXT NOT NULL,
  pending_intent TEXT,
  pending_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gp_bot_sessions_phone ON public.gp_bot_sessions(from_phone);
CREATE INDEX IF NOT EXISTS idx_gp_bot_sessions_updated ON public.gp_bot_sessions(updated_at DESC);

ALTER TABLE public.gp_bot_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read gp_bot_sessions" ON public.gp_bot_sessions;
CREATE POLICY "Staff read gp_bot_sessions" ON public.gp_bot_sessions
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff write gp_bot_sessions" ON public.gp_bot_sessions;
CREATE POLICY "Staff write gp_bot_sessions" ON public.gp_bot_sessions
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP TRIGGER IF EXISTS trg_gp_bot_sessions_updated ON public.gp_bot_sessions;
CREATE TRIGGER trg_gp_bot_sessions_updated
  BEFORE UPDATE ON public.gp_bot_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) gp_unknown_contacts : numéros inconnus reçus sur le 122
CREATE TABLE IF NOT EXISTS public.gp_unknown_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  from_name TEXT,
  message TEXT,
  contacted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  followed_up BOOLEAN NOT NULL DEFAULT false,
  followed_up_at TIMESTAMPTZ,
  followed_up_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_gp_unknown_phone ON public.gp_unknown_contacts(phone);
CREATE INDEX IF NOT EXISTS idx_gp_unknown_pending ON public.gp_unknown_contacts(followed_up) WHERE followed_up = false;

ALTER TABLE public.gp_unknown_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read gp_unknown_contacts" ON public.gp_unknown_contacts;
CREATE POLICY "Staff read gp_unknown_contacts" ON public.gp_unknown_contacts
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff write gp_unknown_contacts" ON public.gp_unknown_contacts;
CREATE POLICY "Staff write gp_unknown_contacts" ON public.gp_unknown_contacts
  FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- 3) Pause bot par transporteur (admin prend le relais)
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS bot_paused_until TIMESTAMPTZ;
