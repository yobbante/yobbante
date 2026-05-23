ALTER TABLE public.whatsapp_outbound_messages REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_inbound_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_outbound_messages;