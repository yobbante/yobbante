
-- 1. Transporteurs : URL départ personnelle
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS depart_url TEXT;

UPDATE public.transporteurs
   SET depart_url = 'https://yobbante.com/gp/depart/' || reference
 WHERE depart_url IS NULL AND reference IS NOT NULL;

-- 2. manual_departures : tracking origine + rappels
ALTER TABLE public.manual_departures
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'admin'
    CHECK (created_via IN ('admin','gp_self','whatsapp_import','bot')),
  ADD COLUMN IF NOT EXISTS notified_admin_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_48h_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_manual_departures_reminder_48h
  ON public.manual_departures(departure_date)
  WHERE reminder_48h_sent_at IS NULL AND status = 'active';

-- 3. RPC publique — contexte GP pour pré-remplir le formulaire
CREATE OR REPLACE FUNCTION public.gp_get_context(p_ref TEXT)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
BEGIN
  SELECT reference, prenom, nom, telephone_1, whatsapp, destinations
    INTO t
    FROM public.transporteurs
   WHERE reference = p_ref AND actif = true
   LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reference', t.reference,
    'prenom', COALESCE(t.prenom, ''),
    'nom', COALESCE(t.nom, ''),
    'telephone', COALESCE(t.whatsapp, t.telephone_1, ''),
    'destinations', COALESCE(t.destinations, ARRAY[]::text[])
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gp_get_context(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gp_get_context(TEXT) TO anon, authenticated;

-- 4. RPC publique — publier un départ
CREATE OR REPLACE FUNCTION public.gp_publish_departure(
  p_ref TEXT,
  p_destination_city TEXT,
  p_destination_country TEXT,
  p_departure_date DATE,
  p_kg NUMERIC,
  p_phone TEXT
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  v_id UUID;
  v_kg INTEGER;
  v_phone TEXT;
  v_admin_phone TEXT := '+221784604003';
  v_msg_admin TEXT;
  v_msg_gp TEXT;
BEGIN
  -- Validations
  IF p_ref IS NULL OR length(btrim(p_ref)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_ref');
  END IF;
  IF p_destination_city IS NULL OR length(btrim(p_destination_city)) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'missing_destination');
  END IF;
  IF p_departure_date IS NULL OR p_departure_date < CURRENT_DATE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_date');
  END IF;
  IF p_kg IS NULL OR p_kg <= 0 OR p_kg > 500 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_kg');
  END IF;

  SELECT reference, prenom, nom, telephone_1, whatsapp
    INTO t
    FROM public.transporteurs
   WHERE reference = p_ref AND actif = true
   LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'transporteur_not_found');
  END IF;

  v_kg := GREATEST(1, ceil(p_kg))::int;
  v_phone := COALESCE(NULLIF(btrim(p_phone),''), t.whatsapp, t.telephone_1);

  INSERT INTO public.manual_departures (
    origin_country, origin_city,
    destination_country, destination_city,
    transport_mode, departure_date,
    total_capacity_kg, available_capacity_kg,
    carrier_name, carrier_contact,
    transporteur_ref, source, status, publication_status,
    created_via, published_at
  ) VALUES (
    'SN', 'Dakar',
    UPPER(COALESCE(p_destination_country, '')), p_destination_city,
    'air', p_departure_date,
    v_kg, v_kg,
    trim(COALESCE(t.prenom,'') || ' ' || COALESCE(t.nom,'')), v_phone,
    t.reference, 'gp_self', 'active', 'published',
    'gp_self', now()
  ) RETURNING id INTO v_id;

  -- Notif admin
  v_msg_admin := 'Nouveau depart : '
              || COALESCE(t.prenom, t.reference)
              || ' -> ' || p_destination_city
              || E'\n' || to_char(p_departure_date, 'DD/MM/YYYY')
              || ' . ' || v_kg::text || 'kg'
              || E'\nRef GP : ' || t.reference;

  PERFORM public._wa_send_via_function(
    'admin', v_admin_phone,
    'free_text',
    jsonb_build_object('text', v_msg_admin),
    NULL, NULL, 'gp_departure_self_publish'
  );

  PERFORM public.enqueue_admin_notification(
    'gp_departure_self_publish', v_msg_admin, NULL,
    jsonb_build_object(
      'departure_id', v_id,
      'transporteur_ref', t.reference,
      'destination', p_destination_city,
      'date', p_departure_date,
      'kg', v_kg
    )
  );

  -- Confirmation GP (depuis 122)
  v_msg_gp := 'Depart ' || p_destination_city
           || ' ' || to_char(p_departure_date, 'DD/MM/YYYY')
           || ' . ' || v_kg::text || 'kg publie !'
           || E'\nOn cherche des colis pour vous !';

  PERFORM public._wa_send_via_function(
    'gp', v_phone,
    'free_text',
    jsonb_build_object('text', v_msg_gp),
    NULL, NULL, 'gp_departure_self_publish_confirm'
  );

  UPDATE public.manual_departures
     SET notified_admin_at = now()
   WHERE id = v_id;

  RETURN jsonb_build_object(
    'ok', true,
    'departure_id', v_id,
    'transporteur_name', COALESCE(t.prenom, '') || ' ' || COALESCE(t.nom, ''),
    'destination', p_destination_city,
    'date', p_departure_date,
    'kg', v_kg
  );
END;
$$;

REVOKE ALL ON FUNCTION public.gp_publish_departure(TEXT, TEXT, TEXT, DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gp_publish_departure(TEXT, TEXT, TEXT, DATE, NUMERIC, TEXT) TO anon, authenticated;

-- 5. Realtime sur manual_departures (idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.manual_departures;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
