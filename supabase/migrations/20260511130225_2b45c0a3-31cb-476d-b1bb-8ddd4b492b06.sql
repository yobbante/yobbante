
-- 1. Restrict relay_addresses public read: only authenticated users
DROP POLICY IF EXISTS "Public read active relays" ON public.relay_addresses;
CREATE POLICY "Authenticated read active relays"
  ON public.relay_addresses
  FOR SELECT
  TO authenticated
  USING ((active = true) OR is_staff(auth.uid()));

-- 2. Add UPDATE/DELETE policies on addresses (owner-scoped)
CREATE POLICY "Users can update own addresses"
  ON public.addresses
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own addresses"
  ON public.addresses
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. Revoke EXECUTE on sensitive SECURITY DEFINER functions from anon/public
REVOKE EXECUTE ON FUNCTION public.cancel_shipment(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_match_shipment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.rematch_waiting_shipments() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.monitor_shipment_etas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.expire_unpaid_shipments() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.mark_overdue_invoices() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_progress_departures() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_user_contact(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_shipment_tracking_number() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.generate_identifier_code(warehouse_country) FROM PUBLIC, anon;
