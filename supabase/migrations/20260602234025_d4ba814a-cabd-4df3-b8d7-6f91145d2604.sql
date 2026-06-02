-- 1) Dedup table for admin notifications
CREATE TABLE IF NOT EXISTS public.admin_notifications_sent (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dedup_key TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  dossier_id UUID,
  phone_sent_to TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT ON public.admin_notifications_sent TO authenticated;
GRANT ALL ON public.admin_notifications_sent TO service_role;

ALTER TABLE public.admin_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view admin notif sent"
  ON public.admin_notifications_sent
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_notif_sent_lookup
  ON public.admin_notifications_sent (dedup_key, sent_at DESC);

-- 2) Cancellation attribution
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS cancelled_by TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS departure_confirmed_by_client BOOLEAN,
  ADD COLUMN IF NOT EXISTS departure_decision_reason TEXT,
  ADD COLUMN IF NOT EXISTS departure_decided_at TIMESTAMPTZ;
