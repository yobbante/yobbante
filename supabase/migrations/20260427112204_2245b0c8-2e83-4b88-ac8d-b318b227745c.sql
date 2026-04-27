
-- 1. Extend shipment_status enum (keep existing UPPERCASE convention)
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'CONFIRMED';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'MATCHED';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'IN_PREPARATION';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'ARRIVED';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'OUT_FOR_DELIVERY';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'CANCELLED';
ALTER TYPE public.shipment_status ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- 2. New columns on shipments
ALTER TABLE public.shipments
  ADD COLUMN IF NOT EXISTS tracking_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS quote_id uuid,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 3. Tracking number generator: YOB-YYYY-XXXXX (5-digit zero-padded sequence per year)
CREATE SEQUENCE IF NOT EXISTS public.shipment_tracking_seq;

CREATE OR REPLACE FUNCTION public.generate_shipment_tracking_number()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  yr text := to_char(now(), 'YYYY');
  n  bigint := nextval('public.shipment_tracking_seq');
BEGIN
  RETURN 'YOB-' || yr || '-' || lpad((n % 100000)::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_shipment_tracking_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.tracking_number IS NULL OR length(NEW.tracking_number) = 0 THEN
    NEW.tracking_number := public.generate_shipment_tracking_number();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipments_tracking_number ON public.shipments;
CREATE TRIGGER trg_shipments_tracking_number
BEFORE INSERT ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.set_shipment_tracking_number();

-- Backfill tracking numbers for existing shipments
UPDATE public.shipments
   SET tracking_number = public.generate_shipment_tracking_number()
 WHERE tracking_number IS NULL;

-- 4. updated_at trigger on shipments
DROP TRIGGER IF EXISTS trg_shipments_updated_at ON public.shipments;
CREATE TRIGGER trg_shipments_updated_at
BEFORE UPDATE ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. shipment_events: immutable audit log
CREATE TABLE IF NOT EXISTS public.shipment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  triggered_by text NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system','admin','client')),
  from_status text,
  to_status text,
  note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment ON public.shipment_events(shipment_id, created_at DESC);

ALTER TABLE public.shipment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own shipment events"
ON public.shipment_events FOR SELECT
TO authenticated
USING (
  is_staff(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = shipment_events.shipment_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Staff insert shipment events"
ON public.shipment_events FOR INSERT
TO authenticated
WITH CHECK (is_staff(auth.uid()));

-- (No UPDATE / DELETE policies = immutable for everyone; SECURITY DEFINER triggers still work.)

-- 6. notifications_log
CREATE TABLE IF NOT EXISTS public.notifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid REFERENCES public.shipments(id) ON DELETE CASCADE,
  user_id uuid,
  channel text NOT NULL CHECK (channel IN ('whatsapp','email','sms','in_app')),
  recipient text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','retry')),
  error text,
  attempts int NOT NULL DEFAULT 0,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_log_shipment ON public.notifications_log(shipment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_log_status ON public.notifications_log(status, created_at) WHERE status IN ('pending','retry');

ALTER TABLE public.notifications_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications_log FOR SELECT
TO authenticated
USING (
  is_staff(auth.uid())
  OR auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.shipments s
    WHERE s.id = notifications_log.shipment_id AND s.user_id = auth.uid()
  )
);

CREATE POLICY "Staff manage notifications"
ON public.notifications_log FOR ALL
TO authenticated
USING (is_staff(auth.uid()))
WITH CHECK (is_staff(auth.uid()));

-- 7. Auto-log shipment_events on every status change
CREATE OR REPLACE FUNCTION public.log_shipment_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, from_status, to_status, note)
    VALUES (NEW.id, 'shipment_created', 'system', NULL, NEW.status::text,
            'Envoi créé · ' || COALESCE(NEW.tracking_number, ''));
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, from_status, to_status)
    VALUES (NEW.id, 'status_changed', 'system', OLD.status::text, NEW.status::text);
  END IF;

  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
    INSERT INTO public.shipment_events (shipment_id, event_type, triggered_by, from_status, to_status, note)
    VALUES (NEW.id, 'payment_status_changed', 'system', OLD.payment_status, NEW.payment_status,
            'Paiement: ' || OLD.payment_status || ' → ' || NEW.payment_status);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_shipment_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_shipment_tracking_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.generate_shipment_tracking_number() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_shipments_log_status ON public.shipments;
CREATE TRIGGER trg_shipments_log_status
AFTER INSERT OR UPDATE OF status, payment_status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.log_shipment_status_change();
