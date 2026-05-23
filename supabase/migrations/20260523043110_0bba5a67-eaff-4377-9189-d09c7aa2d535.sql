
-- 1. Add admin_notified_at to dossier_events
ALTER TABLE public.dossier_events
  ADD COLUMN IF NOT EXISTS admin_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_dossier_events_admin_pending
  ON public.dossier_events (created_at)
  WHERE admin_notified_at IS NULL;

-- 2. Admin notifications queue
CREATE TABLE IF NOT EXISTS public.admin_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  payload JSONB DEFAULT '{}'::jsonb,
  dossier_id UUID REFERENCES public.dossiers(id) ON DELETE SET NULL,
  notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view admin notifications"
  ON public.admin_notifications FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_notif_pending
  ON public.admin_notifications (created_at)
  WHERE notified_at IS NULL;

-- 3. Helper to enqueue
CREATE OR REPLACE FUNCTION public.enqueue_admin_notification(
  p_event_type TEXT,
  p_message TEXT,
  p_dossier_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'::jsonb
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id UUID;
BEGIN
  INSERT INTO public.admin_notifications (event_type, message, dossier_id, payload)
  VALUES (p_event_type, p_message, p_dossier_id, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- 4. Trigger B: nouveau dossier manuel
CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_manual_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route TEXT;
  v_client TEXT;
  v_msg TEXT;
BEGIN
  IF COALESCE(NEW.intake_method::text, '') <> 'manual_intake' THEN
    RETURN NEW;
  END IF;

  v_client := COALESCE(NEW.sender_name, NEW.recipient_name, 'N/A');
  v_route  := COALESCE(NEW.origin_country::text, '?') || ' -> ' || COALESCE(NEW.destination_country, '?');
  v_msg := 'Nouveau dossier manuel cree : ' || COALESCE(NEW.tracking_id, NEW.reference, NEW.id::text)
        || E'\nClient : ' || v_client
        || E'\nRoute : ' || v_route
        || E'\nCanal : ' || COALESCE(NEW.source, 'manuel')
        || E'\nVoir : yobbante.com/admin';

  PERFORM public.enqueue_admin_notification(
    'new_manual_dossier', v_msg, NEW.id,
    jsonb_build_object(
      'tracking_id', NEW.tracking_id,
      'client', v_client,
      'origin', NEW.origin_country,
      'destination', NEW.destination_country
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_new_manual_dossier ON public.dossiers;
CREATE TRIGGER trg_admin_new_manual_dossier
AFTER INSERT ON public.dossiers
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_admin_new_manual_dossier();

-- 5. Trigger F: changement de statut dossier
CREATE OR REPLACE FUNCTION public.trg_notify_admin_dossier_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_msg TEXT;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_msg := 'Statut mis a jour : ' || COALESCE(NEW.tracking_id, NEW.reference, NEW.id::text)
          || ' -> ' || NEW.status::text
          || E'\nPar : Admin';
    PERFORM public.enqueue_admin_notification(
      'dossier_status_changed', v_msg, NEW.id,
      jsonb_build_object('from', OLD.status, 'to', NEW.status)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_dossier_status_changed ON public.dossiers;
CREATE TRIGGER trg_admin_dossier_status_changed
AFTER UPDATE OF status ON public.dossiers
FOR EACH ROW
EXECUTE FUNCTION public.trg_notify_admin_dossier_status();
