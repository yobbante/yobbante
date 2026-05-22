CREATE OR REPLACE FUNCTION public.trg_dossier_whatsapp_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prenom text;
  v_full_name text;
  v_phone text;
  v_route text;
  v_eta text;
  v_dep_date text;
  v_transporteur record;
  v_service text;
  v_weight text;
BEGIN
  IF COALESCE(NEW.skip_whatsapp_trigger, false) = true THEN
    RETURN NEW;
  END IF;

  IF COALESCE(NEW.source, '') = 'bot_client_session' THEN
    RETURN NEW;
  END IF;

  IF NEW.buyer_name IS NULL
     OR length(btrim(NEW.buyer_name)) = 0
     OR upper(btrim(NEW.buyer_name)) = 'N/A'
     OR NEW.contact_phone IS NULL
     OR length(btrim(NEW.contact_phone)) < 6
     OR NEW.tracking_id IS NULL THEN
    RETURN NEW;
  END IF;

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
  v_service := COALESCE(NEW.service_type, NEW.app_source, 'Yobbanté');
  v_weight := COALESCE(NEW.estimated_weight::text, '—') || 'kg';

  IF TG_OP = 'INSERT' THEN
    IF v_phone IS NOT NULL AND length(btrim(v_phone)) >= 6 THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'order_confirmation',
        jsonb_build_array(
          v_prenom,
          COALESCE(NEW.tracking_id, NEW.reference, ''),
          v_service,
          v_route,
          v_weight
        ),
        NEW.id, NULL, 'dossier_insert'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
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
            v_weight,
            COALESCE(NEW.contact_phone, '—')
          ),
          NEW.id, v_transporteur.id, 'status_assigned'
        );
      END IF;

      IF v_phone IS NOT NULL AND length(btrim(v_phone)) >= 6 THEN
        PERFORM public._wa_send_via_function(
          'client', v_phone, 'departure_assigned',
          jsonb_build_array(
            v_prenom,
            COALESCE(NEW.tracking_id, NEW.reference, ''),
            v_route,
            v_dep_date
          ),
          NEW.id, NULL, 'status_assigned_client'
        );
      END IF;
    END IF;

    IF NEW.status = 'COLLECTED' AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'package_collected',
        jsonb_build_array(v_prenom, COALESCE(NEW.tracking_id, NEW.reference, ''), COALESCE(NEW.destination_country, '')),
        NEW.id, NULL, 'status_collected'
      );
    END IF;

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

    IF NEW.status = 'ARRIVED_HUB' AND v_phone IS NOT NULL THEN
      PERFORM public._wa_send_via_function(
        'client', v_phone, 'package_arrived',
        jsonb_build_array(v_prenom, COALESCE(NEW.tracking_id, NEW.reference, ''), COALESCE(NEW.destination_country, '')),
        NEW.id, NULL, 'status_arrived_hub'
      );
    END IF;

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
  INSERT INTO public.whatsapp_outbound_messages (
    to_phone, recipient_type, status, error_message, trigger_type, dossier_id
  ) VALUES (
    COALESCE(v_phone, 'unknown'), 'client', 'trigger_error', SQLERRM, 'trigger_exception', NEW.id
  );
  RETURN NEW;
END;
$function$;