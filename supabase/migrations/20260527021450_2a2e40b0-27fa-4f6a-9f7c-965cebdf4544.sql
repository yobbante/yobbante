ALTER TABLE public.whatsapp_outbound_messages
  ADD COLUMN IF NOT EXISTS message_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS interactive_payload jsonb;