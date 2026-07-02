
-- 1) SUPA_security_definer_view: convert view to SECURITY INVOKER
ALTER VIEW public.public_active_departures SET (security_invoker = true);

-- 2) SUPA_function_search_path_mutable: pin search_path on dekk_orders_touch
DO $mig$
DECLARE fn oid;
BEGIN
  SELECT p.oid INTO fn FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname='dekk_orders_touch' LIMIT 1;
  IF fn IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.dekk_orders_touch() SET search_path = public';
  END IF;
END $mig$;

-- 3) SUPA_anon_security_definer_function_executable
DO $mig$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM PUBLIC',
                     r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I(%s) FROM anon',
                     r.proname, r.args);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END LOOP;
END $mig$;

DO $mig$
DECLARE
  fn_name text;
  public_fns text[] := ARRAY[
    'lookup_dossier_public',
    'get_assigned_departure_public',
    'gp_request_auth',
    'gp_consume_token',
    'set_dossier_cod_public',
    'confirm_departure_public',
    'client_decide_departure',
    'client_cancel_dossier',
    'client_update_pickup',
    'apply_edit_token',
    'get_edit_token',
    'review_exists_for_tracking'
  ];
  r record;
BEGIN
  FOREACH fn_name IN ARRAY public_fns LOOP
    FOR r IN
      SELECT pg_get_function_identity_arguments(p.oid) AS args
      FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
      WHERE n.nspname='public' AND p.proname = fn_name
    LOOP
      BEGIN
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(%s) TO anon, authenticated',
                       fn_name, r.args);
      EXCEPTION WHEN OTHERS THEN NULL; END;
    END LOOP;
  END LOOP;
END $mig$;

-- 4) SUPA_rls_policy_always_true
DROP POLICY IF EXISTS anyone_insert_order ON public.dekk_orders;
CREATE POLICY anyone_insert_order ON public.dekk_orders
  FOR INSERT
  WITH CHECK (
    customer_phone IS NOT NULL AND length(trim(customer_phone)) >= 6
    AND customer_name IS NOT NULL AND length(trim(customer_name)) >= 1
  );

DROP POLICY IF EXISTS "Anyone insert redemption" ON public.dekk_promo_redemptions;
CREATE POLICY "Anyone insert redemption" ON public.dekk_promo_redemptions
  FOR INSERT
  WITH CHECK (
    order_id IS NOT NULL AND promo_id IS NOT NULL
  );

-- 5) transporteur_events_public_insert
DROP POLICY IF EXISTS "System can insert transporteur_events" ON public.transporteur_events;
CREATE POLICY "Staff or service can insert transporteur_events"
  ON public.transporteur_events
  FOR INSERT
  WITH CHECK (
    auth.role() = 'service_role' OR is_staff(auth.uid())
  );

-- 6) dekk_orders_public_read
DROP POLICY IF EXISTS anyone_select_order ON public.dekk_orders;
CREATE POLICY staff_select_order ON public.dekk_orders
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  );

-- 7) dekk_order_events_public_read
DROP POLICY IF EXISTS anyone_select_event ON public.dekk_order_events;
CREATE POLICY staff_select_event ON public.dekk_order_events
  FOR SELECT
  USING (
    auth.role() = 'service_role'
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
  );

-- 8) invoices_bucket_no_user_read
DROP POLICY IF EXISTS "Users read own invoices" ON storage.objects;
CREATE POLICY "Users read own invoices" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'invoices'
    AND EXISTS (
      SELECT 1 FROM public.dossiers d
      WHERE d.user_id = auth.uid()
        AND storage.objects.name = d.tracking_id || '.pdf'
    )
  );

-- 9) voice_messages_bucket_public — restrict SELECT to staff
DROP POLICY IF EXISTS "Public read voice-messages" ON storage.objects;
CREATE POLICY "Staff read voice-messages" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-messages'
    AND is_staff(auth.uid())
  );
