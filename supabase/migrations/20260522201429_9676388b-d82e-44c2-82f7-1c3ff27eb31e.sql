CREATE TABLE IF NOT EXISTS public.client_bot_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  pending_intent TEXT,
  pending_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  bot_paused_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_bot_sessions_phone ON public.client_bot_sessions(from_phone);

ALTER TABLE public.client_bot_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage client_bot_sessions"
ON public.client_bot_sessions
FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER trg_client_bot_sessions_updated_at
BEFORE UPDATE ON public.client_bot_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();