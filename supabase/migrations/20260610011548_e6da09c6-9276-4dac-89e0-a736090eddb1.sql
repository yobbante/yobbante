
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS wizard_step smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profile_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS gp_notes text;

CREATE OR REPLACE FUNCTION public.get_gp_dashboard(_ref text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref varchar(4);
  v_profile jsonb;
  v_departures jsonb;
BEGIN
  v_ref := lpad(regexp_replace(coalesce(_ref, ''), '\D', '', 'g'), 4, '0');

  SELECT to_jsonb(t) - 'created_at' - 'updated_at' INTO v_profile
  FROM (
    SELECT id, reference, prenom, nom, telephone_1, whatsapp, ville, zone,
           photo_url, default_rate_per_kg, rates_per_city, gp_notes,
           wizard_step, profile_completed_at, whatsapp_confirmed_at,
           konnekt_registered, is_beta_validated, actif
    FROM public.transporteurs
    WHERE reference = v_ref
    LIMIT 1
  ) t;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  SELECT coalesce(jsonb_agg(d ORDER BY d.departure_date), '[]'::jsonb) INTO v_departures
  FROM (
    SELECT id, origin_city, destination_city, departure_date,
           total_capacity_kg, available_capacity_kg, price_override_xof,
           transport_mode, status, short_ref, notes, created_at
    FROM public.manual_departures
    WHERE transporteur_ref = v_ref
    ORDER BY departure_date DESC
    LIMIT 100
  ) d;

  RETURN jsonb_build_object(
    'found', true,
    'profile', v_profile,
    'departures', v_departures
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gp_dashboard(text) TO anon, authenticated, service_role;
