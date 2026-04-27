REVOKE EXECUTE ON FUNCTION public.enqueue_shipment_notification() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shipment_status_message(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shipment_status_message(text, text) TO service_role;