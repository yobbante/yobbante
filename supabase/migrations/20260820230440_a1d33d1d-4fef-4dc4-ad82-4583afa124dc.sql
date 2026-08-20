CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  audience text NOT NULL CHECK (audience IN ('admin','chauffeur')),
  user_id uuid,
  chauffeur_id uuid REFERENCES public.chauffeurs(id) ON DELETE CASCADE,
  user_agent text,
  last_success_at timestamptz,
  failure_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_audience_idx ON public.push_subscriptions (audience);
CREATE INDEX IF NOT EXISTS push_subscriptions_chauffeur_idx ON public.push_subscriptions (chauffeur_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage their own push subscriptions"
ON public.push_subscriptions FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff can read push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Staff can read push subscriptions"
ON public.push_subscriptions FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'staff')
  OR public.has_role(auth.uid(), 'agent_terrain')
  OR public.has_role(auth.uid(), 'agent_support')
);

DROP TRIGGER IF EXISTS push_subscriptions_updated_at ON public.push_subscriptions;
CREATE TRIGGER push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();