
REVOKE ALL ON FUNCTION public.monitor_shipment_etas() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expire_unpaid_shipments() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.auto_progress_departures() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rematch_waiting_shipments() FROM PUBLIC, anon, authenticated;
