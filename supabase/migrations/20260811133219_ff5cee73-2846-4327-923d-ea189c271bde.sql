-- 1. route_default_rates: public read only active rows
DROP POLICY IF EXISTS "route_default_rates readable by all" ON public.route_default_rates;
CREATE POLICY "route_default_rates public read active"
  ON public.route_default_rates FOR SELECT
  TO anon, authenticated
  USING (active = true);
CREATE POLICY "route_default_rates staff read all"
  ON public.route_default_rates FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

-- 2. dekk_orders / dekk_order_events: staff SELECT scoped to authenticated + service_role
DROP POLICY IF EXISTS "staff_select_order" ON public.dekk_orders;
CREATE POLICY "staff_select_order"
  ON public.dekk_orders FOR SELECT
  TO authenticated, service_role
  USING (
    (auth.role() = 'service_role')
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

DROP POLICY IF EXISTS "staff_select_event" ON public.dekk_order_events;
CREATE POLICY "staff_select_event"
  ON public.dekk_order_events FOR SELECT
  TO authenticated, service_role
  USING (
    (auth.role() = 'service_role')
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
  );

-- 3. custom_cities: audit trail for tampering detection
ALTER TABLE public.custom_cities
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS updated_by uuid;

CREATE OR REPLACE FUNCTION public.custom_cities_set_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(NEW.created_by, auth.uid());
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_custom_cities_audit ON public.custom_cities;
CREATE TRIGGER trg_custom_cities_audit
  BEFORE INSERT OR UPDATE ON public.custom_cities
  FOR EACH ROW EXECUTE FUNCTION public.custom_cities_set_audit();