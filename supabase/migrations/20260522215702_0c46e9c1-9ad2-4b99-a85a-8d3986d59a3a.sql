
-- Table edit_tokens
CREATE TABLE IF NOT EXISTS public.edit_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('dossier_client','dossier_destinataire','transporteur','client')),
  entity_id UUID NOT NULL,
  fields_allowed TEXT[] NOT NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours'),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edit_tokens_token ON public.edit_tokens(token);
CREATE INDEX IF NOT EXISTS idx_edit_tokens_entity ON public.edit_tokens(entity_type, entity_id);

ALTER TABLE public.edit_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can manage edit_tokens"
  ON public.edit_tokens
  FOR ALL
  TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

-- Table de journalisation pour les modifications transporteurs
CREATE TABLE IF NOT EXISTS public.transporteur_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transporteur_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  event_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.transporteur_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view transporteur_events"
  ON public.transporteur_events
  FOR SELECT
  TO authenticated
  USING (public.is_staff(auth.uid()));

CREATE POLICY "System can insert transporteur_events"
  ON public.transporteur_events
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (true);

-- RPC: récupération du token + valeurs actuelles
CREATE OR REPLACE FUNCTION public.get_edit_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  v_current JSONB := '{}'::jsonb;
  v_label TEXT;
  d RECORD;
  tr RECORD;
  pr RECORD;
BEGIN
  SELECT * INTO t FROM public.edit_tokens WHERE token = p_token LIMIT 1;
  IF t IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;
  IF t.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'used');
  END IF;
  IF t.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'expired');
  END IF;

  IF t.entity_type IN ('dossier_client','dossier_destinataire') THEN
    SELECT * INTO d FROM public.dossiers WHERE id = t.entity_id LIMIT 1;
    IF d IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'entity_not_found');
    END IF;
    v_label := COALESCE(d.tracking_id, d.reference, '');
    v_current := jsonb_build_object(
      'sender_name', d.sender_name,
      'sender_phone', d.sender_phone,
      'sender_address', d.sender_address,
      'pickup_date', d.pickup_date,
      'recipient_name', d.recipient_name,
      'recipient_phone', d.recipient_phone,
      'recipient_address', d.recipient_address
    );
  ELSIF t.entity_type = 'transporteur' THEN
    SELECT * INTO tr FROM public.transporteurs WHERE id = t.entity_id LIMIT 1;
    IF tr IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'entity_not_found');
    END IF;
    v_label := COALESCE(tr.prenom || ' ' || tr.nom, tr.telephone_1, '');
    v_current := jsonb_build_object(
      'telephone_1', tr.telephone_1,
      'adresse_collecte_dakar', tr.adresse_collecte_dakar,
      'adresses_remise', tr.adresses_remise
    );
  ELSIF t.entity_type = 'client' THEN
    SELECT * INTO pr FROM public.profiles WHERE id = t.entity_id LIMIT 1;
    IF pr IS NULL THEN
      RETURN jsonb_build_object('valid', false, 'reason', 'entity_not_found');
    END IF;
    v_label := COALESCE(pr.full_name, pr.email, '');
    v_current := jsonb_build_object(
      'full_name', pr.full_name,
      'phone', pr.phone,
      'email', pr.email
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'entity_type', t.entity_type,
    'entity_id', t.entity_id,
    'fields_allowed', t.fields_allowed,
    'label', v_label,
    'current', v_current,
    'expires_at', t.expires_at
  );
END;
$$;

-- RPC: application de la modification
CREATE OR REPLACE FUNCTION public.apply_edit_token(p_token TEXT, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t RECORD;
  d RECORD;
  tr RECORD;
  pr RECORD;
  v_field TEXT;
  v_old TEXT;
  v_new TEXT;
  v_changes JSONB := '[]'::jsonb;
  v_label TEXT := '';
  v_url TEXT := 'https://tlvuextleczdsqxoguyq.supabase.co/functions/v1/notify-admin-edit';
BEGIN
  SELECT * INTO t FROM public.edit_tokens WHERE token = p_token FOR UPDATE;
  IF t IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'not_found');
  END IF;
  IF t.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'used');
  END IF;
  IF t.expires_at < now() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'expired');
  END IF;

  IF t.entity_type IN ('dossier_client','dossier_destinataire') THEN
    SELECT * INTO d FROM public.dossiers WHERE id = t.entity_id FOR UPDATE;
    IF d IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'entity_not_found'); END IF;
    v_label := COALESCE(d.tracking_id, d.reference, d.id::text);

    FOREACH v_field IN ARRAY t.fields_allowed LOOP
      IF p_payload ? v_field THEN
        v_new := NULLIF(btrim(p_payload->>v_field), '');
        IF v_field = 'sender_name' THEN
          v_old := d.sender_name;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET sender_name = v_new WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','sender_name','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'sender_phone' THEN
          v_old := d.sender_phone;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET sender_phone = v_new WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','sender_phone','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'sender_address' THEN
          v_old := d.sender_address;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET sender_address = v_new WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','sender_address','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'pickup_date' THEN
          v_old := d.pickup_date::text;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET pickup_date = v_new::date WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','pickup_date','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'recipient_name' THEN
          v_old := d.recipient_name;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET recipient_name = v_new WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','recipient_name','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'recipient_phone' THEN
          v_old := d.recipient_phone;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET recipient_phone = v_new WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','recipient_phone','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'recipient_address' THEN
          v_old := d.recipient_address;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.dossiers SET recipient_address = v_new WHERE id = d.id;
            v_changes := v_changes || jsonb_build_object('field','recipient_address','old',v_old,'new',v_new);
          END IF;
        END IF;
      END IF;
    END LOOP;

    IF jsonb_array_length(v_changes) > 0 THEN
      INSERT INTO public.dossier_events (dossier_id, event_type, event_data, visible_to_client)
      VALUES (d.id, 'public_edit_applied', jsonb_build_object('changes', v_changes, 'token_id', t.id), false);
    END IF;

  ELSIF t.entity_type = 'transporteur' THEN
    SELECT * INTO tr FROM public.transporteurs WHERE id = t.entity_id FOR UPDATE;
    IF tr IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'entity_not_found'); END IF;
    v_label := COALESCE(tr.prenom || ' ' || tr.nom, tr.telephone_1, tr.id::text);

    FOREACH v_field IN ARRAY t.fields_allowed LOOP
      IF p_payload ? v_field THEN
        IF v_field = 'telephone_1' THEN
          v_new := NULLIF(btrim(p_payload->>v_field), '');
          v_old := tr.telephone_1;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.transporteurs SET telephone_1 = v_new WHERE id = tr.id;
            v_changes := v_changes || jsonb_build_object('field','telephone_1','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'adresse_collecte_dakar' THEN
          v_new := NULLIF(btrim(p_payload->>v_field), '');
          v_old := tr.adresse_collecte_dakar;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.transporteurs SET adresse_collecte_dakar = v_new WHERE id = tr.id;
            v_changes := v_changes || jsonb_build_object('field','adresse_collecte_dakar','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'adresses_remise' THEN
          v_old := tr.adresses_remise::text;
          v_new := p_payload->>v_field;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.transporteurs SET adresses_remise = (p_payload->'adresses_remise') WHERE id = tr.id;
            v_changes := v_changes || jsonb_build_object('field','adresses_remise','old',v_old,'new',v_new);
          END IF;
        END IF;
      END IF;
    END LOOP;

    IF jsonb_array_length(v_changes) > 0 THEN
      INSERT INTO public.transporteur_events (transporteur_id, event_type, event_data)
      VALUES (tr.id, 'public_edit_applied', jsonb_build_object('changes', v_changes, 'token_id', t.id));
    END IF;

  ELSIF t.entity_type = 'client' THEN
    SELECT * INTO pr FROM public.profiles WHERE id = t.entity_id FOR UPDATE;
    IF pr IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'entity_not_found'); END IF;
    v_label := COALESCE(pr.full_name, pr.email, pr.id::text);

    FOREACH v_field IN ARRAY t.fields_allowed LOOP
      IF p_payload ? v_field THEN
        v_new := NULLIF(btrim(p_payload->>v_field), '');
        IF v_field = 'full_name' THEN
          v_old := pr.full_name;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.profiles SET full_name = v_new WHERE id = pr.id;
            v_changes := v_changes || jsonb_build_object('field','full_name','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'phone' THEN
          v_old := pr.phone;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.profiles SET phone = v_new WHERE id = pr.id;
            v_changes := v_changes || jsonb_build_object('field','phone','old',v_old,'new',v_new);
          END IF;
        ELSIF v_field = 'email' THEN
          v_old := pr.email;
          IF v_new IS DISTINCT FROM v_old THEN
            UPDATE public.profiles SET email = v_new WHERE id = pr.id;
            v_changes := v_changes || jsonb_build_object('field','email','old',v_old,'new',v_new);
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.edit_tokens SET used_at = now() WHERE id = t.id;

  -- Notification admin (best-effort)
  BEGIN
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json'),
      body := jsonb_build_object(
        'entity_type', t.entity_type,
        'entity_id', t.entity_id,
        'label', v_label,
        'changes', v_changes
      ),
      timeout_milliseconds := 5000
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('ok', true, 'changes', v_changes, 'label', v_label);
END;
$$;

-- Permettre l'appel anonyme aux RPCs publiques
GRANT EXECUTE ON FUNCTION public.get_edit_token(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_edit_token(TEXT, JSONB) TO anon, authenticated;
