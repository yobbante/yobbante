
-- ── Partenaires fret (aérien / maritime) ─────────────────────────────────
CREATE TABLE public.freight_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference text NOT NULL UNIQUE,
  company_name text NOT NULL,
  mode text NOT NULL DEFAULT 'air' CHECK (mode IN ('air','sea','both')),
  contact_name text,
  phone text NOT NULL,
  email text,
  city text,
  country text,
  hubs text[] NOT NULL DEFAULT '{}',
  default_price_per_kg_xof integer,
  default_price_per_cbm_xof integer,
  default_transit_days integer,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.freight_partners TO authenticated;
GRANT ALL ON public.freight_partners TO service_role;
ALTER TABLE public.freight_partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage freight partners"
  ON public.freight_partners FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_staff(auth.uid()) OR public.has_role(auth.uid(),'admin'));

CREATE TRIGGER freight_partners_updated_at
  BEFORE UPDATE ON public.freight_partners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Référence auto FP-XXXX
CREATE OR REPLACE FUNCTION public.freight_partner_set_reference()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reference IS NULL OR NEW.reference = '' THEN
    NEW.reference := 'FP-' || upper(substr(replace(gen_random_uuid()::text,'-',''), 1, 5));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER freight_partners_set_reference
  BEFORE INSERT ON public.freight_partners
  FOR EACH ROW EXECUTE FUNCTION public.freight_partner_set_reference();

-- ── Liens de connexion + sessions ────────────────────────────────────────
CREATE TABLE public.freight_partner_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL UNIQUE,
  partner_id uuid NOT NULL REFERENCES public.freight_partners(id) ON DELETE CASCADE,
  used boolean NOT NULL DEFAULT false,
  used_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.freight_partner_tokens TO service_role;
ALTER TABLE public.freight_partner_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read partner tokens"
  ON public.freight_partner_tokens FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.freight_partner_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token text NOT NULL UNIQUE,
  partner_id uuid NOT NULL REFERENCES public.freight_partners(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.freight_partner_sessions TO service_role;
ALTER TABLE public.freight_partner_sessions ENABLE ROW LEVEL SECURITY;

-- ── Champs départs aérien / maritime ─────────────────────────────────────
ALTER TABLE public.manual_departures
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES public.freight_partners(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS carrier_company text,
  ADD COLUMN IF NOT EXISTS flight_or_vessel text,
  ADD COLUMN IF NOT EXISTS cutoff_date date,
  ADD COLUMN IF NOT EXISTS port_origin text,
  ADD COLUMN IF NOT EXISTS port_destination text,
  ADD COLUMN IF NOT EXISTS container_type text,
  ADD COLUMN IF NOT EXISTS capacity_cbm numeric,
  ADD COLUMN IF NOT EXISTS price_per_kg_xof integer,
  ADD COLUMN IF NOT EXISTS price_per_cbm_xof integer,
  ADD COLUMN IF NOT EXISTS transit_days integer;

-- ── Fonctions partenaire (sans compte auth) ──────────────────────────────
CREATE OR REPLACE FUNCTION public.fp_request_auth(p_phone text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_digits text; v_last9 text; v_p record; v_token text;
BEGIN
  IF p_phone IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF length(v_digits) < 9 THEN RETURN jsonb_build_object('found', false); END IF;
  v_last9 := right(v_digits, 9);

  SELECT * INTO v_p FROM public.freight_partners
   WHERE status = 'active'
     AND right(regexp_replace(coalesce(phone,''), '\D', '', 'g'), 9) = v_last9
   ORDER BY updated_at DESC LIMIT 1;

  IF v_p IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.freight_partner_tokens (token, partner_id, expires_at)
  VALUES (v_token, v_p.id, now() + interval '30 minutes');

  RETURN jsonb_build_object('found', true, 'token', v_token,
    'reference', v_p.reference, 'company_name', v_p.company_name, 'phone', v_p.phone);
END;
$$;

CREATE OR REPLACE FUNCTION public.fp_consume_token(p_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_row record; v_p record; v_session text;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;
  SELECT * INTO v_row FROM public.freight_partner_tokens WHERE token = p_token FOR UPDATE;
  IF v_row IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'invalid'); END IF;
  IF v_row.used THEN RETURN jsonb_build_object('ok', false, 'reason', 'used'); END IF;
  IF v_row.expires_at < now() THEN RETURN jsonb_build_object('ok', false, 'reason', 'expired'); END IF;

  UPDATE public.freight_partner_tokens SET used = true, used_at = now() WHERE id = v_row.id;
  SELECT * INTO v_p FROM public.freight_partners WHERE id = v_row.partner_id;
  IF v_p IS NULL OR v_p.status <> 'active' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid');
  END IF;

  v_session := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.freight_partner_sessions (session_token, partner_id, expires_at)
  VALUES (v_session, v_p.id, now() + interval '24 hours');

  RETURN jsonb_build_object('ok', true, 'session', v_session, 'reference', v_p.reference,
    'partner', to_jsonb(v_p) - 'notes' - 'created_by');
END;
$$;

CREATE OR REPLACE FUNCTION public.fp_partner_id(p_session text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT partner_id FROM public.freight_partner_sessions
   WHERE session_token = p_session AND expires_at > now() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.fp_me(p_session text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_p record;
BEGIN
  v_id := public.fp_partner_id(p_session);
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT * INTO v_p FROM public.freight_partners WHERE id = v_id AND status = 'active';
  IF v_p IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  RETURN jsonb_build_object('ok', true, 'partner', to_jsonb(v_p) - 'notes' - 'created_by');
END;
$$;

CREATE OR REPLACE FUNCTION public.fp_departures(p_session text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_rows jsonb;
BEGIN
  v_id := public.fp_partner_id(p_session);
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY d.departure_date DESC), '[]'::jsonb)
    INTO v_rows FROM public.manual_departures d WHERE d.partner_id = v_id;
  RETURN jsonb_build_object('ok', true, 'departures', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.fp_save_departure(p_session text, p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid; v_p record; v_dep_id uuid; v_mode text; v_cap integer; v_existing record;
BEGIN
  v_id := public.fp_partner_id(p_session);
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized'); END IF;
  SELECT * INTO v_p FROM public.freight_partners WHERE id = v_id AND status = 'active';
  IF v_p IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'unauthorized'); END IF;

  v_mode := coalesce(p_payload->>'transport_mode', 'air');
  IF v_mode NOT IN ('air','sea_lcl') THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'mode');
  END IF;
  v_cap := coalesce((p_payload->>'total_capacity_kg')::integer, 0);

  v_dep_id := nullif(p_payload->>'id','')::uuid;

  IF v_dep_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.manual_departures WHERE id = v_dep_id AND partner_id = v_id;
    IF v_existing IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;

    UPDATE public.manual_departures SET
      origin_city = coalesce(p_payload->>'origin_city', origin_city),
      origin_country = p_payload->>'origin_country',
      destination_city = coalesce(p_payload->>'destination_city', destination_city),
      destination_country = p_payload->>'destination_country',
      departure_date = coalesce((p_payload->>'departure_date')::date, departure_date),
      arrival_estimate = nullif(p_payload->>'arrival_estimate','')::date,
      cutoff_date = nullif(p_payload->>'cutoff_date','')::date,
      total_capacity_kg = greatest(v_cap, 0),
      available_capacity_kg = greatest(v_cap - reserved_capacity_kg, 0),
      carrier_company = p_payload->>'carrier_company',
      flight_or_vessel = p_payload->>'flight_or_vessel',
      port_origin = p_payload->>'port_origin',
      port_destination = p_payload->>'port_destination',
      container_type = p_payload->>'container_type',
      capacity_cbm = nullif(p_payload->>'capacity_cbm','')::numeric,
      price_per_kg_xof = nullif(p_payload->>'price_per_kg_xof','')::integer,
      price_per_cbm_xof = nullif(p_payload->>'price_per_cbm_xof','')::integer,
      transit_days = nullif(p_payload->>'transit_days','')::integer,
      notes = p_payload->>'notes',
      updated_at = now()
    WHERE id = v_dep_id;
    RETURN jsonb_build_object('ok', true, 'id', v_dep_id);
  END IF;

  INSERT INTO public.manual_departures (
    partner_id, transport_mode, origin_city, origin_country, destination_city, destination_country,
    departure_date, arrival_estimate, cutoff_date, total_capacity_kg, available_capacity_kg,
    carrier_name, carrier_company, carrier_contact, flight_or_vessel, port_origin, port_destination,
    container_type, capacity_cbm, price_per_kg_xof, price_per_cbm_xof, transit_days,
    notes, source, created_via, status, publication_status
  ) VALUES (
    v_id, v_mode,
    coalesce(p_payload->>'origin_city',''), p_payload->>'origin_country',
    coalesce(p_payload->>'destination_city',''), p_payload->>'destination_country',
    (p_payload->>'departure_date')::date,
    nullif(p_payload->>'arrival_estimate','')::date,
    nullif(p_payload->>'cutoff_date','')::date,
    greatest(v_cap, 0), greatest(v_cap, 0),
    v_p.company_name, p_payload->>'carrier_company', v_p.phone,
    p_payload->>'flight_or_vessel', p_payload->>'port_origin', p_payload->>'port_destination',
    p_payload->>'container_type', nullif(p_payload->>'capacity_cbm','')::numeric,
    nullif(p_payload->>'price_per_kg_xof','')::integer,
    nullif(p_payload->>'price_per_cbm_xof','')::integer,
    nullif(p_payload->>'transit_days','')::integer,
    p_payload->>'notes', 'partner', 'partner', 'active', 'ready'
  ) RETURNING id INTO v_dep_id;

  RETURN jsonb_build_object('ok', true, 'id', v_dep_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fp_cancel_departure(p_session text, p_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  v_id := public.fp_partner_id(p_session);
  IF v_id IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  UPDATE public.manual_departures
     SET status = 'cancelled', publication_status = 'closed', updated_at = now()
   WHERE id = p_id AND partner_id = v_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Admin : générer un lien d'accès partenaire
CREATE OR REPLACE FUNCTION public.fp_admin_create_token(p_partner_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token text; v_p record;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin') OR public.is_staff(auth.uid())) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;
  SELECT * INTO v_p FROM public.freight_partners WHERE id = p_partner_id;
  IF v_p IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'not_found'); END IF;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.freight_partner_tokens (token, partner_id, expires_at)
  VALUES (v_token, p_partner_id, now() + interval '7 days');
  RETURN jsonb_build_object('ok', true, 'token', v_token, 'reference', v_p.reference,
    'company_name', v_p.company_name, 'phone', v_p.phone);
END;
$$;
