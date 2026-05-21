
-- =====================================================================
-- WhatsApp auto-triggers on dossiers
-- All HTTP calls wrapped in EXCEPTION block; failures logged but
-- never crash the underlying UPDATE/INSERT.
-- =====================================================================

CREATE OR REPLACE FUNCTION public._wa_send_via_function(
  p_recipient_type text,
  p_recipient_phone text,
  p_template_name text,
  p_template_params jsonb,
  p_dossier_id uuid,
  p_transporteur_id uuid,
  p_trigger_type text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/send-whatsapp';
  v_body jsonb;
BEGIN
  IF p_recipient_phone IS NULL OR length(btrim(p_recipient_phone)) < 6 THEN
    RETURN;
  END IF;

  v_body := jsonb_build_object(
    'recipient_type', p_recipient_type,
    'recipient_phone', p_recipient_phone,
    'template_name', p_template_name,
    'template_params', p_template_params,
    'dossier_id', p_dossier_id,
    'transporteur_id', p_transporteur_id,
    'trigger_type', p_trigger_type
  );

  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := v_body,
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN
    -- Log the failure without crashing the parent transaction
    INSERT INTO public.whatsapp_outbound_messages (
      to_phone, recipient_type, template_name, template_params,
      dossier_id, transporteur_id, status, error_message, trigger_type
    ) VALUES (
      p_recipient_phone, p_recipient_type, p_template_name, p_template_params,
      p_dossier_id, p_transporteur_id, 'trigger_error', SQLERRM, p_trigger_type
    );
  END;
END;
$$;

-- ---------------------------------------------------------------------
-- Trigger function — orchestrates all dossier-driven notifications
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_dossier_whatsapp_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prenom text;
  v_full_name text;
  v_phone text;
  v_route text;
  v_eta text;
  v_dep_date text;
  v_transporteur record;
BEGIN
  -- Resolve client name + phone
  SELECT COALESCE(p.full_name, NEW.buyer_name, 'Client'),
         COALESCE(NEW.contact_phone, p.phone)
    INTO v_full_name, v_phone
    FROM public.profiles p
   WHERE p.user_id = NEW.user_id
   LIMIT 1;

  IF v_full_name IS NULL THEN v_full_name := COALESCE(NEW.buyer_name, 'Client'); END IF;
  IF v_phone IS NULL THEN v_phone := NEW.contact_phone; END IF;
  v_prenom := split_part(btrim(v_full_name), ' ', 1);

  v_route := COALESCE(NEW.origin_country::text, '') || ' → ' || COALESCE(NEW.destination_country, '');
  v_dep_date := to_char(COALESCE(NEW.estimated_delivery_date, current_date), 'DD/MM/YYYY');
  v_eta := CASE WHEN NEW.estimated_delivery_date IS NOT NULL
                THEN to_char(NEW.estimated_delivery_date, 'DD/MM/YYYY')
                ELSE 'à venir' END;

  -- ===== INSERT : confirmation de commande (site_web only) =====
  IF TG_OP = 'INSERT' THEN
    IF NEW.source = 'site_web' AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'order_confirmation',
        jsonb_build_array(
          v_prenom,
          COALESCE(NEW.tracking_id, NEW.reference, ''),
          COALESCE(NEW.destination_country, ''),
          COALESCE(NEW.estimated_cost::text, '—')
        ),
        NEW.id, NULL, 'dossier_insert'
      );
    END IF;
    RETURN NEW;
  END IF;

  -- ===== UPDATE : status transitions =====
  IF NEW.status IS DISTINCT FROM OLD.status THEN

    -- ASSIGNED → notif GP
    IF NEW.status = 'ASSIGNED' AND NEW.assigned_transporteur_ref IS NOT NULL THEN
      SELECT id, telephone_1, COALESCE(prenom, split_part(nom, ' ', 1), 'Transporteur') AS prenom_gp
        INTO v_transporteur
        FROM public.transporteurs
       WHERE reference = NEW.assigned_transporteur_ref
       LIMIT 1;

      IF v_transporteur.telephone_1 IS NOT NULL THEN
        PERFORM public._wa_send_via_function(
          'gp', v_transporteur.telephone_1, 'mission_assigned_gp',
          jsonb_build_array(
            v_transporteur.prenom_gp,
            COALESCE(NEW.reference, ''),
            v_dep_date,
            v_route,
            v_full_name,
            COALESCE(NEW.estimated_weight::text, '—') || 'kg',
            COALESCE(NEW.contact_phone, '—')
          ),
          NEW.id, v_transporteur.id, 'status_assigned'
        );
      END IF;
    END IF;

    -- COLLECTED → notif client
    IF NEW.status = 'COLLECTED' AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'package_collected',
        jsonb_build_array(v_prenom, COALESCE(NEW.tracking_id, NEW.reference, ''), COALESCE(NEW.destination_country, '')),
        NEW.id, NULL, 'status_collected'
      );
    END IF;

    -- IN_TRANSIT → notif client (only if paid OR cash_on_delivery)
    IF NEW.status = 'IN_TRANSIT'
       AND (NEW.payment_status = 'paid' OR NEW.cash_on_delivery = true)
       AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'package_in_transit',
        jsonb_build_array(
          v_prenom,
          COALESCE(NEW.tracking_id, NEW.reference, ''),
          COALESCE(NEW.destination_country, ''),
          v_dep_date,
          v_eta
        ),
        NEW.id, NULL, 'status_in_transit'
      );
    END IF;

    -- ARRIVED_HUB → notif client
    IF NEW.status = 'ARRIVED_HUB' AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'package_arrived',
        jsonb_build_array(v_prenom, COALESCE(NEW.tracking_id, NEW.reference, ''), COALESCE(NEW.destination_country, '')),
        NEW.id, NULL, 'status_arrived_hub'
      );
    END IF;

    -- DELIVERED → notif client
    IF NEW.status = 'DELIVERED' AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'package_delivered',
        jsonb_build_array(v_prenom, COALESCE(NEW.tracking_id, NEW.reference, '')),
        NEW.id, NULL, 'status_delivered'
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Absolute safety: never block the underlying write
  INSERT INTO public.whatsapp_outbound_messages (
    to_phone, recipient_type, status, error_message, trigger_type, dossier_id
  ) VALUES (
    COALESCE(v_phone, 'unknown'), 'client', 'trigger_error', SQLERRM, 'trigger_exception', NEW.id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_dossier_whatsapp_notify_insert ON public.dossiers;
DROP TRIGGER IF EXISTS trg_dossier_whatsapp_notify_update ON public.dossiers;

CREATE TRIGGER trg_dossier_whatsapp_notify_insert
  AFTER INSERT ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_whatsapp_notify();

CREATE TRIGGER trg_dossier_whatsapp_notify_update
  AFTER UPDATE OF status ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_dossier_whatsapp_notify();
