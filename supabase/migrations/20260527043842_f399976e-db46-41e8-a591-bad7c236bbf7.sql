
-- 1) Add city columns to dossiers
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS origin_city TEXT,
  ADD COLUMN IF NOT EXISTS destination_city TEXT;

-- 2) Replace trigger so EVERY new dossier (any intake_method/source) notifies super-admin,
--    with cities included when available.
CREATE OR REPLACE FUNCTION public.trg_notify_admin_new_manual_dossier()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_route TEXT;
  v_client TEXT;
  v_origin TEXT;
  v_dest TEXT;
  v_msg TEXT;
BEGIN
  v_client := COALESCE(NEW.sender_name, NEW.recipient_name, NEW.buyer_name, 'N/A');
  v_origin := COALESCE(NEW.origin_city, NEW.origin_country::text, '?');
  v_dest   := COALESCE(NEW.destination_city, NEW.destination_country, '?');
  v_route  := v_origin || ' -> ' || v_dest;

  v_msg := 'Nouveau dossier : ' || COALESCE(NEW.tracking_id, NEW.reference, NEW.id::text)
        || E'\nClient : ' || v_client
        || E'\nRoute : ' || v_route
        || E'\nCanal : ' || COALESCE(NEW.source, NEW.app_source, 'site')
        || E'\nIntake : ' || COALESCE(NEW.intake_method::text, 'self_service')
        || E'\nVoir : yobbante.com/admin';

  PERFORM public.enqueue_admin_notification(
    'new_dossier', v_msg, NEW.id,
    jsonb_build_object(
      'tracking_id', NEW.tracking_id,
      'client', v_client,
      'origin_city', NEW.origin_city,
      'destination_city', NEW.destination_city,
      'origin', NEW.origin_country,
      'destination', NEW.destination_country,
      'intake_method', NEW.intake_method,
      'source', NEW.source
    )
  );
  RETURN NEW;
END;
$$;
