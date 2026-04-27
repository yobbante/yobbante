
REVOKE EXECUTE ON FUNCTION public.auto_match_shipment(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rematch_waiting_shipments() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.score_departure(text,text,text,text,date,text,text,text,text,date) FROM PUBLIC, anon, authenticated;
