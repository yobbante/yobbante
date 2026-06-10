
ALTER TABLE public.transporteurs
  ADD COLUMN IF NOT EXISTS beta_wizard_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS beta_tarif_defaut integer,
  ADD COLUMN IF NOT EXISTS beta_notes_conditions text,
  ADD COLUMN IF NOT EXISTS beta_migrated_at timestamptz;

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
  v_missions jsonb;
  v_payments jsonb;
BEGIN
  v_ref := lpad(regexp_replace(coalesce(_ref, ''), '\D', '', 'g'), 4, '0');

  SELECT to_jsonb(t) INTO v_profile
  FROM (
    SELECT id, reference, prenom, nom, telephone_1, whatsapp, ville, zone,
           photo_url, default_rate_per_kg, rates_per_city, gp_notes,
           wizard_step, profile_completed_at,
           beta_wizard_completed_at, beta_tarif_defaut, beta_notes_conditions,
           whatsapp_confirmed_at, konnekt_registered, is_beta_validated, actif,
           last_bot_activity_at
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
    WHERE transporteur_ref = v_ref AND status != 'cancelled'
    ORDER BY departure_date DESC
    LIMIT 100
  ) d;

  SELECT coalesce(jsonb_agg(m ORDER BY m.created_at DESC), '[]'::jsonb) INTO v_missions
  FROM (
    SELECT id, tracking_id, status, destination_city, destination_country,
           actual_weight_kg, estimated_weight, gp_amount, gp_paid, paid_at, created_at
    FROM public.dossiers
    WHERE assigned_transporteur_ref = v_ref
      AND status IS NOT NULL
      AND status NOT IN ('CANCELLED', 'CLOSED', 'DELIVERED')
    ORDER BY created_at DESC
    LIMIT 50
  ) m;

  SELECT coalesce(jsonb_agg(p ORDER BY p.created_at DESC), '[]'::jsonb) INTO v_payments
  FROM (
    SELECT id, tracking_id, gp_amount, gp_paid, gp_paid_at, gp_payment_method,
           status, created_at
    FROM public.dossiers
    WHERE assigned_transporteur_ref = v_ref AND gp_amount IS NOT NULL
    ORDER BY created_at DESC
    LIMIT 100
  ) p;

  RETURN jsonb_build_object(
    'found', true,
    'profile', v_profile,
    'departures', v_departures,
    'missions', v_missions,
    'payments', v_payments
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_gp_dashboard(text) TO anon, authenticated, service_role;
