-- Data API grants (missing → insert blocked)
GRANT INSERT ON public.dekk_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dekk_orders TO authenticated;
GRANT ALL ON public.dekk_orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dekk_order_events TO authenticated;
GRANT ALL ON public.dekk_order_events TO service_role;

GRANT SELECT ON public.dekk_promo_codes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dekk_promo_codes TO authenticated;
GRANT ALL ON public.dekk_promo_codes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dekk_promo_redemptions TO authenticated;
GRANT ALL ON public.dekk_promo_redemptions TO service_role;

-- Anonymous insert policy scoped to anon/authenticated explicitly
DROP POLICY IF EXISTS anyone_insert_order ON public.dekk_orders;
CREATE POLICY anyone_insert_order ON public.dekk_orders
FOR INSERT TO anon, authenticated
WITH CHECK (
  customer_phone IS NOT NULL AND length(trim(customer_phone)) >= 6
  AND customer_name IS NOT NULL AND length(trim(customer_name)) >= 1
  AND (user_id IS NULL OR user_id = auth.uid())
  AND payment_status = 'pending'
  AND paid_at IS NULL
);

-- Public payment tracking (no direct SELECT on the table)
CREATE OR REPLACE FUNCTION public.dekk_order_payment_status(_reference text)
RETURNS TABLE (reference text, total_fcfa integer, payment_status text, payment_method text, payment_external_id text, paid_at timestamptz, status text, created_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.reference, o.total_fcfa, o.payment_status, o.payment_method, o.payment_external_id, o.paid_at, o.status, o.created_at
  FROM public.dekk_orders o
  WHERE o.reference = upper(trim(_reference))
     OR o.payment_external_id = trim(_reference)
  LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.dekk_order_payment_status(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dekk_order_payment_status(text) TO anon, authenticated, service_role;