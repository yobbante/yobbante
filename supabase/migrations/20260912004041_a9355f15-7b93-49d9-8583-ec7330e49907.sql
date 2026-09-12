ALTER TABLE public.manual_departures DROP CONSTRAINT manual_departures_created_via_check;
ALTER TABLE public.manual_departures ADD CONSTRAINT manual_departures_created_via_check
  CHECK (created_via = ANY (ARRAY['admin','gp_self','whatsapp_import','bot','partner']));