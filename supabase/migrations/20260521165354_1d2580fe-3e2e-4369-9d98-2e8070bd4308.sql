
-- =====================================================
-- WhatsApp Integration: 2-numbers + webhook + bot GP
-- =====================================================

-- 1. Extend dossier_status enum with new GP workflow values
DO $$
BEGIN
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'ASSIGNED';
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'COLLECTED';
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'WEIGHED';
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'ARRIVED_HUB';
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'CANCELLED';
  ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'ARCHIVED';
END$$;

-- 2. Add GP workflow columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS actual_weight_kg NUMERIC,
  ADD COLUMN IF NOT EXISTS final_amount_xof NUMERIC,
  ADD COLUMN IF NOT EXISTS cash_on_delivery BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS collected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS weighed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

-- =====================================================
-- 3. whatsapp_outbound_messages — log of every send
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_outbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_phone TEXT NOT NULL,
  from_number TEXT,
  recipient_type TEXT NOT NULL DEFAULT 'client',
  template_name TEXT,
  template_params JSONB,
  message_body TEXT,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  transporteur_id UUID REFERENCES public.transporteurs(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'sent',
  wamid TEXT,
  error_message TEXT,
  trigger_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_wa_out_to_phone ON public.whatsapp_outbound_messages(to_phone);
CREATE INDEX IF NOT EXISTS idx_wa_out_wamid ON public.whatsapp_outbound_messages(wamid);
CREATE INDEX IF NOT EXISTS idx_wa_out_dossier ON public.whatsapp_outbound_messages(dossier_id);
CREATE INDEX IF NOT EXISTS idx_wa_out_created ON public.whatsapp_outbound_messages(created_at DESC);

ALTER TABLE public.whatsapp_outbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read wa_outbound" ON public.whatsapp_outbound_messages;
CREATE POLICY "Staff read wa_outbound" ON public.whatsapp_outbound_messages
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert wa_outbound" ON public.whatsapp_outbound_messages;
CREATE POLICY "Staff insert wa_outbound" ON public.whatsapp_outbound_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update wa_outbound" ON public.whatsapp_outbound_messages;
CREATE POLICY "Staff update wa_outbound" ON public.whatsapp_outbound_messages
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- =====================================================
-- 4. whatsapp_inbound_messages — log of every reception
-- =====================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_inbound_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_phone TEXT NOT NULL,
  from_name TEXT,
  to_number TEXT,
  message_body TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  media_url TEXT,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  transporteur_id UUID REFERENCES public.transporteurs(id) ON DELETE SET NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  channel TEXT NOT NULL DEFAULT 'client',
  bot_intent TEXT,
  bot_response TEXT,
  replied_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  replied_at TIMESTAMPTZ,
  reply_template TEXT,
  wamid TEXT UNIQUE,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_in_from_phone ON public.whatsapp_inbound_messages(from_phone);
CREATE INDEX IF NOT EXISTS idx_wa_in_received ON public.whatsapp_inbound_messages(received_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_in_unread ON public.whatsapp_inbound_messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_wa_in_channel ON public.whatsapp_inbound_messages(channel);

ALTER TABLE public.whatsapp_inbound_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read wa_inbound" ON public.whatsapp_inbound_messages;
CREATE POLICY "Staff read wa_inbound" ON public.whatsapp_inbound_messages
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff insert wa_inbound" ON public.whatsapp_inbound_messages;
CREATE POLICY "Staff insert wa_inbound" ON public.whatsapp_inbound_messages
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff update wa_inbound" ON public.whatsapp_inbound_messages;
CREATE POLICY "Staff update wa_inbound" ON public.whatsapp_inbound_messages
  FOR UPDATE TO authenticated USING (public.is_staff(auth.uid()));

-- Realtime publication for unread badge
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_inbound_messages;
ALTER TABLE public.whatsapp_inbound_messages REPLICA IDENTITY FULL;

-- =====================================================
-- 5. dossier_events — generic timeline
-- =====================================================
CREATE TABLE IF NOT EXISTS public.dossier_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_data JSONB,
  visible_to_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_dossier_events_dossier ON public.dossier_events(dossier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dossier_events_type ON public.dossier_events(event_type);

ALTER TABLE public.dossier_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff read dossier_events" ON public.dossier_events;
CREATE POLICY "Staff read dossier_events" ON public.dossier_events
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Owner read dossier_events" ON public.dossier_events;
CREATE POLICY "Owner read dossier_events" ON public.dossier_events
  FOR SELECT TO authenticated USING (
    visible_to_client = true AND EXISTS (
      SELECT 1 FROM public.dossiers d WHERE d.id = dossier_id AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Staff insert dossier_events" ON public.dossier_events;
CREATE POLICY "Staff insert dossier_events" ON public.dossier_events
  FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- Trigger: insert event on dossier status change
CREATE OR REPLACE FUNCTION public.log_dossier_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
    VALUES (NEW.id, 'dossier_created',
      jsonb_build_object('status', NEW.status::text, 'reference', NEW.reference),
      true);
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
    VALUES (NEW.id, 'status_changed',
      jsonb_build_object('from', OLD.status::text, 'to', NEW.status::text),
      true);
  END IF;

  IF NEW.assigned_transporteur_ref IS DISTINCT FROM OLD.assigned_transporteur_ref
     AND NEW.assigned_transporteur_ref IS NOT NULL THEN
    INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
    VALUES (NEW.id, 'transporteur_assigned',
      jsonb_build_object('transporteur_ref', NEW.assigned_transporteur_ref),
      false);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_dossier_status_change ON public.dossiers;
CREATE TRIGGER trg_log_dossier_status_change
  AFTER INSERT OR UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.log_dossier_status_change();
