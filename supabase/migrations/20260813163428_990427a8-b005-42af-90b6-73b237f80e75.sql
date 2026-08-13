-- 1. New role value (compared as text everywhere to stay transaction-safe)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent_support';

-- 2. Helper: is this user a restricted support agent (and not an admin/staff)?
CREATE OR REPLACE FUNCTION public.is_agent_support(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'agent_support'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin', 'staff')
  )
$$;

-- 3. Support agents count as staff for the shared operational tables
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text IN ('admin', 'staff', 'agent_support')
  )
$$;

-- 4. Hard block: finance + system/integration tables are invisible to agents
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'business_invoices','refund_requests','dekk_orders','dekk_promo_codes',
    'dekk_promo_redemptions','pricing_adjustments','route_default_rates',
    'zone_pricing','product_forfaits','products','bot_global_settings',
    'gp_auth_tokens','super_admin_audit_log','super_admin_sessions','edit_tokens',
    'delivery_partners'
  ] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS "Agents have no access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Agents have no access" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.is_agent_support(auth.uid())) WITH CHECK (NOT public.is_agent_support(auth.uid()))', t);
  END LOOP;
END $$;

-- 5. Read-only for agents: departures, carriers, hubs, zones, relays
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'manual_departures','konnekt_departures','konnekt_sync_log','transporteurs',
    'transporteur_inscriptions','livreurs','relay_points','relay_addresses',
    'coverage_zones','zones','custom_cities'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Agents read only" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Agents read only" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (true) WITH CHECK (NOT public.is_agent_support(auth.uid()))', t);
    EXECUTE format('DROP POLICY IF EXISTS "Agents cannot delete" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Agents cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_agent_support(auth.uid()))', t);
  END LOOP;
END $$;

-- 6. No hard deletes for agents on core records
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'dossiers','profiles','packages','shipments','business_accounts',
    'whatsapp_inbound_messages','whatsapp_outbound_messages','dossier_documents',
    'dossier_customs_documents','reception_orders','customer_reviews'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Agents cannot delete" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "Agents cannot delete" ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_agent_support(auth.uid()))', t);
  END LOOP;
END $$;