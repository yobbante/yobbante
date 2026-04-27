-- Add phone column to profiles if missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;

-- Helper: get user's contact info
CREATE OR REPLACE FUNCTION public.get_user_contact(_user_id uuid)
RETURNS TABLE(phone text, email text, full_name text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone, COALESCE(p.email, u.email::text) AS email, p.full_name
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = _user_id
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_contact(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_contact(uuid) TO service_role;

-- Map status → message template
CREATE OR REPLACE FUNCTION public.shipment_status_message(_status text, _tracking text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE _status
    WHEN 'CONFIRMED'        THEN '✅ Votre envoi ' || _tracking || ' est confirmé. Recherche d''un transporteur en cours.'
    WHEN 'WAITING_FOR_MATCH' THEN '⏳ Envoi ' || _tracking || ' en attente d''un départ disponible.'
    WHEN 'MATCHED'          THEN '🎯 Envoi ' || _tracking || ' assigné à un départ. Préparation en cours.'
    WHEN 'IN_PREPARATION'   THEN '📦 Envoi ' || _tracking || ' en préparation pour expédition.'
    WHEN 'IN_TRANSIT'       THEN '✈️ Envoi ' || _tracking || ' est en transit.'
    WHEN 'CUSTOMS'          THEN '🛃 Envoi ' || _tracking || ' en dédouanement.'
    WHEN 'ARRIVED'          THEN '📍 Envoi ' || _tracking || ' arrivé à destination.'
    WHEN 'OUT_FOR_DELIVERY' THEN '🚚 Envoi ' || _tracking || ' en cours de livraison aujourd''hui.'
    WHEN 'DELIVERED'        THEN '🎉 Envoi ' || _tracking || ' livré avec succès. Merci !'
    WHEN 'ON_HOLD'          THEN '⚠️ Envoi ' || _tracking || ' en attente — notre équipe vous contacte sous peu.'
    WHEN 'CANCELLED'        THEN '❌ Envoi ' || _tracking || ' annulé.'
    ELSE 'Envoi ' || _tracking || ' : statut mis à jour (' || _status || ').'
  END;
$$;

-- Trigger: enqueue notifications on status change
CREATE OR REPLACE FUNCTION public.enqueue_shipment_notification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c record;
  msg text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  -- Skip noisy intermediate states
  IF NEW.status NOT IN ('CONFIRMED','MATCHED','IN_TRANSIT','CUSTOMS','ARRIVED','OUT_FOR_DELIVERY','DELIVERED','ON_HOLD','CANCELLED') THEN
    RETURN NEW;
  END IF;

  SELECT * INTO c FROM public.get_user_contact(NEW.user_id);
  msg := public.shipment_status_message(NEW.status::text, COALESCE(NEW.tracking_number, NEW.id::text));

  -- WhatsApp (if phone present)
  IF c.phone IS NOT NULL AND length(c.phone) >= 6 THEN
    INSERT INTO public.notifications_log (user_id, shipment_id, channel, recipient, message, status)
    VALUES (NEW.user_id, NEW.id, 'whatsapp', c.phone, msg, 'pending');
  END IF;

  -- Email (always, if available)
  IF c.email IS NOT NULL THEN
    INSERT INTO public.notifications_log (user_id, shipment_id, channel, recipient, subject, message, status)
    VALUES (NEW.user_id, NEW.id, 'email', c.email, 'Mise à jour envoi ' || COALESCE(NEW.tracking_number,''), msg, 'pending');
  END IF;

  -- In-app (always)
  INSERT INTO public.notifications_log (user_id, shipment_id, channel, recipient, message, status)
  VALUES (NEW.user_id, NEW.id, 'in_app', NEW.user_id::text, msg, 'pending');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_shipment_notification ON public.shipments;
CREATE TRIGGER trg_enqueue_shipment_notification
AFTER INSERT OR UPDATE OF status ON public.shipments
FOR EACH ROW EXECUTE FUNCTION public.enqueue_shipment_notification();