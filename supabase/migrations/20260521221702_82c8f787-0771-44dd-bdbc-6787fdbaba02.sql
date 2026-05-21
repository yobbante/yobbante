
-- 1) customer_reviews — cap comment length to 1000 chars
ALTER TABLE public.customer_reviews
  DROP CONSTRAINT IF EXISTS customer_reviews_comment_length;
ALTER TABLE public.customer_reviews
  ADD CONSTRAINT customer_reviews_comment_length
  CHECK (comment IS NULL OR char_length(comment) <= 1000);

-- 2) dekk_orders — status whitelist + server-side total enforcement
ALTER TABLE public.dekk_orders
  DROP CONSTRAINT IF EXISTS dekk_orders_status_check;
ALTER TABLE public.dekk_orders
  ADD CONSTRAINT dekk_orders_status_check
  CHECK (status IN ('pending','paid','processing','shipped','delivered','cancelled','refunded'));

CREATE OR REPLACE FUNCTION public.dekk_orders_enforce_total()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub integer;
  v_disc integer;
  v_total integer;
BEGIN
  v_sub := COALESCE(NEW.subtotal_eur, 0);
  v_disc := GREATEST(0, LEAST(COALESCE(NEW.discount_eur, 0), v_sub));
  v_total := GREATEST(0, v_sub - v_disc);

  -- Always overwrite client-supplied totals
  NEW.discount_eur := v_disc;
  NEW.total_eur := v_total;
  NEW.total_fcfa := v_total * 655;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dekk_orders_enforce_total ON public.dekk_orders;
CREATE TRIGGER trg_dekk_orders_enforce_total
BEFORE INSERT OR UPDATE OF subtotal_eur, discount_eur, total_eur, total_fcfa
ON public.dekk_orders
FOR EACH ROW EXECUTE FUNCTION public.dekk_orders_enforce_total();

-- 3) manual_departures — staff-only read on full table; public view exposes only safe columns
DROP POLICY IF EXISTS "Read active manual departures" ON public.manual_departures;

CREATE OR REPLACE VIEW public.public_active_departures
WITH (security_invoker = false)
AS
SELECT
  id,
  origin_country,
  origin_city,
  destination_country,
  destination_city,
  transport_mode,
  departure_date,
  arrival_estimate,
  total_capacity_kg,
  available_capacity_kg,
  status,
  transporteur_ref,
  short_ref,
  carrier_name
FROM public.manual_departures
WHERE status = 'active';

GRANT SELECT ON public.public_active_departures TO anon, authenticated;
