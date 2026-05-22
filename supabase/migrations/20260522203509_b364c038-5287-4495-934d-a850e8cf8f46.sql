
CREATE TABLE IF NOT EXISTS public.super_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone text NOT NULL UNIQUE,
  pending_intent text,
  pending_step text,
  pending_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.super_admin_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage super_admin_sessions"
  ON public.super_admin_sessions
  FOR ALL TO authenticated
  USING (is_staff(auth.uid()))
  WITH CHECK (is_staff(auth.uid()));

CREATE TRIGGER trg_super_admin_sessions_updated_at
  BEFORE UPDATE ON public.super_admin_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
