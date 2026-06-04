CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  admin_phone text NOT NULL,
  action text NOT NULL,
  gp_reference text,
  gp_id uuid,
  target_phone text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_sa_audit_created_at ON public.super_admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sa_audit_action ON public.super_admin_audit_log (action);
CREATE INDEX IF NOT EXISTS idx_sa_audit_gp_ref ON public.super_admin_audit_log (gp_reference);

GRANT SELECT ON public.super_admin_audit_log TO authenticated;
GRANT ALL ON public.super_admin_audit_log TO service_role;

ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read super_admin_audit_log"
  ON public.super_admin_audit_log
  FOR SELECT
  TO authenticated
  USING (is_staff(auth.uid()));