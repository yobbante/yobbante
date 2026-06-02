
-- 1) Table de déduplication des notifications client
CREATE TABLE public.client_notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  error TEXT,
  UNIQUE (dossier_id, notification_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_notifications_sent TO authenticated;
GRANT ALL ON public.client_notifications_sent TO service_role;

ALTER TABLE public.client_notifications_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all client notifications"
  ON public.client_notifications_sent FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Clients can view notifications for their own dossiers"
  ON public.client_notifications_sent FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.dossiers d WHERE d.id = client_notifications_sent.dossier_id AND d.user_id = auth.uid()
  ));

CREATE INDEX idx_cns_dossier ON public.client_notifications_sent(dossier_id);
CREATE INDEX idx_cns_type_sent ON public.client_notifications_sent(notification_type, sent_at DESC);

-- 2) Table des avis de satisfaction
CREATE TABLE public.satisfaction_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id UUID NOT NULL REFERENCES public.dossiers(id) ON DELETE CASCADE,
  user_id UUID,
  rating TEXT NOT NULL CHECK (rating IN ('excellent','bien','moyen','probleme')),
  comment TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.satisfaction_ratings TO authenticated;
GRANT ALL ON public.satisfaction_ratings TO service_role;

ALTER TABLE public.satisfaction_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view all ratings"
  ON public.satisfaction_ratings FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "Clients can view their own ratings"
  ON public.satisfaction_ratings FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Clients can insert their own ratings"
  ON public.satisfaction_ratings FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE INDEX idx_sat_dossier ON public.satisfaction_ratings(dossier_id);
CREATE INDEX idx_sat_rating ON public.satisfaction_ratings(rating, created_at DESC);

-- 3) Helper pour appeler l'edge function client-notifications
CREATE OR REPLACE FUNCTION public._dispatch_client_notification(p_dossier_id UUID, p_notification_type TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url TEXT := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/client-notifications';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object('dossier_id', p_dossier_id, 'notification_type', p_notification_type),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- best effort
    NULL;
  END;
END;
$$;

-- 4) Trigger principal : dispatche la bonne notification selon l'événement
CREATE OR REPLACE FUNCTION public.trg_dossier_client_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.skip_whatsapp_trigger IS TRUE THEN
    RETURN NEW;
  END IF;

  -- NOTIF 1 : welcome à la création
  IF TG_OP = 'INSERT' THEN
    PERFORM public._dispatch_client_notification(NEW.id, 'welcome');
    RETURN NEW;
  END IF;

  -- NOTIF 3 : collecte confirmée
  IF NEW.status::text = 'COLLECTED' AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    PERFORM public._dispatch_client_notification(NEW.id, 'collected');
  END IF;

  -- NOTIF 4 : paiement reçu
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
    PERFORM public._dispatch_client_notification(NEW.id, 'payment_received');
  END IF;

  -- NOTIF 5 : départ (IN_TRANSIT)
  IF NEW.status::text = 'IN_TRANSIT' AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    PERFORM public._dispatch_client_notification(NEW.id, 'in_transit');
  END IF;

  -- NOTIF 6 : arrivée hub
  IF NEW.status::text = 'ARRIVED_HUB' AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    PERFORM public._dispatch_client_notification(NEW.id, 'arrived_hub');
  END IF;

  -- NOTIF 7 : livré
  IF NEW.status::text = 'DELIVERED' AND OLD.status::text IS DISTINCT FROM NEW.status::text THEN
    PERFORM public._dispatch_client_notification(NEW.id, 'delivered');
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_notifications_ins ON public.dossiers;
CREATE TRIGGER trg_client_notifications_ins
  AFTER INSERT ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_client_notifications();

DROP TRIGGER IF EXISTS trg_client_notifications_upd ON public.dossiers;
CREATE TRIGGER trg_client_notifications_upd
  AFTER UPDATE ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_client_notifications();
