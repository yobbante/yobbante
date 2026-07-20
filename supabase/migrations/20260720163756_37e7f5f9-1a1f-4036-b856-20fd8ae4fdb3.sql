ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'QUOTE_SENT';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'QUOTE_ACCEPTED';
ALTER TYPE public.dossier_status ADD VALUE IF NOT EXISTS 'QUOTE_REFUSED';

CREATE OR REPLACE FUNCTION public.submit_quote_request(
  p_product_description text,
  p_estimated_weight numeric,
  p_origin_country public.warehouse_country,
  p_destination_country text,
  p_origin_city text,
  p_destination_city text,
  p_contact_phone text,
  p_client_name text,
  p_sender_name text DEFAULT NULL,
  p_sender_phone text DEFAULT NULL,
  p_sender_address text DEFAULT NULL,
  p_recipient_name text DEFAULT NULL,
  p_recipient_phone text DEFAULT NULL,
  p_recipient_address text DEFAULT NULL,
  p_pickup_date date DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS TABLE(id uuid, reference text, tracking_id text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.dossiers%ROWTYPE;
  v_phone text := btrim(COALESCE(p_contact_phone, ''));
  v_name text := btrim(COALESCE(p_client_name, ''));
BEGIN
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Nom client invalide' USING ERRCODE = '22023';
  END IF;
  IF length(v_phone) < 6 OR length(v_phone) > 32 THEN
    RAISE EXCEPTION 'Téléphone invalide' USING ERRCODE = '22023';
  END IF;
  IF length(btrim(COALESCE(p_origin_city, ''))) < 2 OR length(btrim(COALESCE(p_destination_city, ''))) < 2 THEN
    RAISE EXCEPTION 'Trajet incomplet' USING ERRCODE = '22023';
  END IF;
  IF p_estimated_weight IS NULL OR p_estimated_weight <= 0 OR p_estimated_weight >= 10000 THEN
    RAISE EXCEPTION 'Poids invalide' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.dossiers (
    user_id, status, product_description, estimated_weight,
    origin_country, destination_country, origin_city, destination_city,
    app_source, source, needs_sourcing, contact_phone,
    sender_name, sender_phone, sender_address,
    recipient_name, recipient_phone, recipient_address,
    pickup_date, buyer_name, buyer_contact, notes
  ) VALUES (
    auth.uid(), 'QUOTE_REQUESTED', left(COALESCE(NULLIF(btrim(p_product_description), ''), 'Demande de devis personnalisé'), 2000), p_estimated_weight,
    p_origin_country, left(btrim(p_destination_country), 120), btrim(p_origin_city), btrim(p_destination_city),
    'expedier_devis_sur_mesure', 'site_web', false, v_phone,
    COALESCE(NULLIF(btrim(p_sender_name), ''), v_name), COALESCE(NULLIF(btrim(p_sender_phone), ''), v_phone), NULLIF(btrim(p_sender_address), ''),
    NULLIF(btrim(p_recipient_name), ''), NULLIF(btrim(p_recipient_phone), ''), NULLIF(btrim(p_recipient_address), ''),
    p_pickup_date, v_name, v_phone, NULLIF(left(btrim(p_notes), 4000), '')
  ) RETURNING * INTO v_row;

  RETURN QUERY SELECT v_row.id, v_row.reference, v_row.tracking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_quote_request(text,numeric,public.warehouse_country,text,text,text,text,text,text,text,text,text,text,text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_quote_request(text,numeric,public.warehouse_country,text,text,text,text,text,text,text,text,text,text,text,date,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_quote_request(text,numeric,public.warehouse_country,text,text,text,text,text,text,text,text,text,text,text,date,text) TO service_role;

CREATE OR REPLACE FUNCTION public.respond_to_quote_public(
  p_tracking text,
  p_response text
)
RETURNS TABLE(reference text, tracking_id text, status public.dossier_status)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status public.dossier_status;
BEGIN
  IF lower(btrim(p_response)) = 'accepted' THEN
    v_status := 'QUOTE_ACCEPTED';
  ELSIF lower(btrim(p_response)) = 'refused' THEN
    v_status := 'QUOTE_REFUSED';
  ELSE
    RAISE EXCEPTION 'Réponse de devis invalide' USING ERRCODE = '22023';
  END IF;

  RETURN QUERY
  UPDATE public.dossiers d
  SET status = v_status,
      quote_response = lower(btrim(p_response)),
      quote_responded_at = now(),
      updated_at = now()
  WHERE (d.tracking_id = btrim(p_tracking) OR d.reference = btrim(p_tracking))
    AND d.status = 'QUOTE_SENT'
    AND d.quote_amount_xof IS NOT NULL
  RETURNING d.reference, d.tracking_id, d.status;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Devis introuvable ou déjà traité' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.respond_to_quote_public(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_to_quote_public(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_quote_public(text,text) TO service_role;