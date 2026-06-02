-- Helper: HTTP call to admin-notify edge function
CREATE OR REPLACE FUNCTION public.notify_admin_http(
  p_notification_type TEXT,
  p_message TEXT,
  p_dossier_id UUID DEFAULT NULL,
  p_dedup_key TEXT DEFAULT NULL,
  p_window_minutes INT DEFAULT 240
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_url TEXT := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/admin-notify';
BEGIN
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body := jsonb_build_object(
        'notification_type', p_notification_type,
        'message', p_message,
        'dossier_id', p_dossier_id,
        'dedup_key', COALESCE(p_dedup_key, p_notification_type || ':' || COALESCE(p_dossier_id::text, 'g')),
        'window_minutes', p_window_minutes
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END;
$$;

-- EVENT 1 — Replace new dossier notification
CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_manual_dossier()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg TEXT;
  v_dest TEXT;
  v_mode TEXT;
  v_weight TEXT;
  v_amount TEXT;
BEGIN
  v_dest := COALESCE(NEW.destination_city, NEW.destination_country, '?');
  v_mode := CASE WHEN NEW.is_express THEN 'Express' ELSE 'Standard' END;
  v_weight := COALESCE(NEW.estimated_weight::text, '?');
  v_amount := COALESCE(round(COALESCE(NEW.declared_value, NEW.estimated_cost, 0))::text, '0');

  v_msg :=
    E'NOUVELLE COMMANDE\n'
    || COALESCE(NEW.tracking_id, NEW.reference) || E'\n\n'
    || COALESCE(NEW.sender_name, 'Client') || ' . ' || COALESCE(NEW.sender_phone, NEW.contact_phone, '—') || E'\n'
    || 'Dakar -> ' || v_dest || E'\n'
    || v_weight || 'kg . ' || v_mode || E'\n'
    || 'Valeur : ' || v_amount || E' FCFA\n'
    || 'Paiement prevu : ' || COALESCE(NEW.payment_method, 'a definir') || E'\n'
    || 'Source : ' || COALESCE(NEW.source, NEW.app_source, 'site') || E'\n\n'
    || E'Actions :\n'
    || 'DOSSIER ' || COALESCE(NEW.tracking_id, NEW.reference) || E'\n'
    || 'ASSIGNE ' || COALESCE(NEW.tracking_id, NEW.reference) || ' [ref_gp]';

  PERFORM public.notify_admin_http('new_order', v_msg, NEW.id,
    'new_order:' || NEW.id::text, 240);
  RETURN NEW;
END;
$$;

-- EVENT 2 — Payment received
CREATE OR REPLACE FUNCTION public.trg_notify_admin_payment_paid()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg TEXT; v_marge NUMERIC;
BEGIN
  IF NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid' THEN
    v_marge := COALESCE(NEW.yobbante_gross_margin, 0);
    v_msg :=
      E'PAIEMENT RECU\n'
      || COALESCE(NEW.tracking_id, NEW.reference) || E'\n'
      || COALESCE(NEW.sender_name, 'Client') || E'\n'
      || 'Montant : ' || round(COALESCE(NEW.final_amount_xof, NEW.estimated_cost, 0))::text || E' FCFA\n'
      || 'Methode : ' || COALESCE(NEW.payment_method, '—') || E'\n'
      || 'Marge estimee : ' || round(v_marge)::text || E' FCFA\n\n'
      || E'Actions :\n'
      || 'T ' || COALESCE(NEW.tracking_id, NEW.reference) || E' -> passer en transit\n'
      || 'DOSSIER ' || COALESCE(NEW.tracking_id, NEW.reference);
    PERFORM public.notify_admin_http('payment_received', v_msg, NEW.id,
      'payment_received:' || NEW.id::text, 240);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_payment_paid ON public.dossiers;
CREATE TRIGGER trg_admin_payment_paid
  AFTER UPDATE OF payment_status ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_payment_paid();

-- EVENT 4/5 — Client confirms or refuses departure
CREATE OR REPLACE FUNCTION public.trg_notify_admin_departure_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg TEXT;
  v_dep RECORD;
  v_gp_name TEXT;
BEGIN
  IF NEW.departure_confirmed_by_client IS NOT DISTINCT FROM OLD.departure_confirmed_by_client THEN
    RETURN NEW;
  END IF;
  IF NEW.departure_confirmed_by_client IS NULL THEN RETURN NEW; END IF;

  SELECT md.*, COALESCE(t.prenom || ' ' || t.nom, t.reference, '—') AS gp_name
  INTO v_dep
  FROM public.manual_departures md
  LEFT JOIN public.transporteurs t ON t.reference = md.transporteur_ref
  WHERE md.id = NEW.assigned_departure_id;
  v_gp_name := COALESCE(v_dep.gp_name, '—');

  IF NEW.departure_confirmed_by_client THEN
    v_msg :=
      E'DEPART CONFIRME PAR CLIENT\n'
      || COALESCE(NEW.tracking_id, NEW.reference) || ' . ' || COALESCE(NEW.sender_name, 'Client') || E'\n'
      || 'Depart #' || COALESCE(v_dep.short_ref, '—')
      || ' . ' || COALESCE(v_dep.destination_city, v_dep.destination_country, '?') || E'\n'
      || 'Date : ' || COALESCE(v_dep.departure_date::text, '—') || E'\n'
      || 'GP : ' || v_gp_name || E'\n\n'
      || 'Tout est en ordre pour ce depart.';
    PERFORM public.notify_admin_http('departure_confirmed_client', v_msg, NEW.id,
      'departure_confirmed:' || NEW.id::text, 240);
  ELSE
    v_msg :=
      E'DEPART REFUSE PAR CLIENT\n'
      || COALESCE(NEW.tracking_id, NEW.reference) || ' . ' || COALESCE(NEW.sender_name, 'Client') || E'\n'
      || 'Raison : ' || COALESCE(NEW.departure_decision_reason, 'non precisee') || E'\n\n'
      || E'Action requise :\n'
      || 'REASSIGNE ' || COALESCE(NEW.tracking_id, NEW.reference) || ' [ref_gp]';
    PERFORM public.notify_admin_http('departure_refused_client', v_msg, NEW.id,
      'departure_refused:' || NEW.id::text, 240);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_departure_decision ON public.dossiers;
CREATE TRIGGER trg_admin_departure_decision
  AFTER UPDATE OF departure_confirmed_by_client ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_departure_decision();

-- EVENT 6/7 — GP accepts or refuses mission
CREATE OR REPLACE FUNCTION public.trg_notify_admin_mission_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_msg TEXT;
  v_gp RECORD;
BEGIN
  IF NEW.mission_accepted IS NOT DISTINCT FROM OLD.mission_accepted THEN
    RETURN NEW;
  END IF;
  IF NEW.mission_accepted IS NULL THEN RETURN NEW; END IF;

  SELECT prenom, nom, reference INTO v_gp
  FROM public.transporteurs
  WHERE reference = COALESCE(NEW.assigned_transporteur_ref, OLD.assigned_transporteur_ref)
  LIMIT 1;

  IF NEW.mission_accepted THEN
    v_msg :=
      E'GP ACCEPTE MISSION\n'
      || COALESCE(v_gp.prenom || ' ' || v_gp.nom, COALESCE(v_gp.reference, '—'))
      || ' (Ref ' || COALESCE(v_gp.reference, '—') || ')' || E'\n'
      || 'Mission : ' || COALESCE(NEW.tracking_id, NEW.reference) || E'\n'
      || 'Dakar -> ' || COALESCE(NEW.destination_city, NEW.destination_country, '?') || E'\n'
      || 'Collecte prevue : ' || COALESCE(NEW.pickup_date::text, 'a definir');
    PERFORM public.notify_admin_http('mission_accepted', v_msg, NEW.id,
      'mission_accepted:' || NEW.id::text, 240);
  ELSE
    v_msg :=
      E'GP REFUSE MISSION\n'
      || COALESCE(v_gp.prenom || ' ' || v_gp.nom, '—')
      || ' a refuse ' || COALESCE(NEW.tracking_id, NEW.reference) || E'\n\n'
      || E'Action requise :\n'
      || 'REASSIGNE ' || COALESCE(NEW.tracking_id, NEW.reference) || ' [ref_gp]';
    PERFORM public.notify_admin_http('mission_refused', v_msg, NEW.id,
      'mission_refused:' || NEW.id::text, 240);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_mission_decision ON public.dossiers;
CREATE TRIGGER trg_admin_mission_decision
  AFTER UPDATE OF mission_accepted ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_mission_decision();

-- EVENT 9 — Client cancellation
CREATE OR REPLACE FUNCTION public.trg_notify_admin_dossier_cancelled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_msg TEXT;
BEGIN
  IF NEW.status = 'CANCELLED'
     AND OLD.status IS DISTINCT FROM 'CANCELLED'
     AND COALESCE(NEW.cancelled_by, '') = 'client' THEN
    v_msg :=
      E'DOSSIER ANNULE PAR CLIENT\n'
      || COALESCE(NEW.tracking_id, NEW.reference) || ' . ' || COALESCE(NEW.sender_name, 'Client') || E'\n'
      || 'Raison : ' || COALESCE(NEW.cancellation_reason, 'non precisee') || E'\n'
      || 'Paiement : ' || COALESCE(NEW.payment_status, 'pending') || E'\n'
      || CASE WHEN NEW.payment_status = 'paid'
              THEN 'Si paye -> rembourser via Wave' ELSE '' END;
    PERFORM public.notify_admin_http('dossier_cancelled_client', v_msg, NEW.id,
      'dossier_cancelled:' || NEW.id::text, 240);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_admin_dossier_cancelled ON public.dossiers;
CREATE TRIGGER trg_admin_dossier_cancelled
  AFTER UPDATE OF status ON public.dossiers
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_admin_dossier_cancelled();
