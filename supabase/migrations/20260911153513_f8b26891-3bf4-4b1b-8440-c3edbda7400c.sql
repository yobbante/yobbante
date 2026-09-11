ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS parent_dossier_id uuid REFERENCES public.dossiers(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS split_index integer,
  ADD COLUMN IF NOT EXISTS split_count integer;

CREATE INDEX IF NOT EXISTS idx_dossiers_parent ON public.dossiers(parent_dossier_id);

CREATE OR REPLACE FUNCTION public.split_dossier(p_dossier_id uuid, p_parts jsonb)
RETURNS SETOF public.dossiers
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent public.dossiers%ROWTYPE;
  v_count int;
  v_i int := 0;
  v_part jsonb;
  v_new_id uuid;
  v_total_weight numeric;
BEGIN
  IF NOT (public.is_staff(auth.uid()) OR public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Non autorise';
  END IF;

  SELECT * INTO v_parent FROM public.dossiers WHERE id = p_dossier_id;
  IF v_parent.id IS NULL THEN
    RAISE EXCEPTION 'Dossier introuvable';
  END IF;
  IF v_parent.parent_dossier_id IS NOT NULL THEN
    RAISE EXCEPTION 'Ce dossier est deja un sous-colis';
  END IF;

  v_count := jsonb_array_length(p_parts);
  IF v_count < 2 THEN
    RAISE EXCEPTION 'Il faut au moins 2 colis';
  END IF;

  SELECT COALESCE(SUM((x->>'weight')::numeric), 0) INTO v_total_weight
  FROM jsonb_array_elements(p_parts) x;

  FOR v_part IN SELECT * FROM jsonb_array_elements(p_parts)
  LOOP
    v_i := v_i + 1;
    INSERT INTO public.dossiers (
      user_id, business_id, dossier_type, status, app_source, source, intake_method,
      origin_country, origin_city, destination_country, destination_city,
      product_description, estimated_weight, actual_weight_kg, quantity, unit,
      declared_value, currency, transport_mode, delivery_mode,
      sender_name, sender_phone, sender_address,
      recipient_name, recipient_phone, recipient_address,
      contact_phone, contact_email,
      pickup_zone, pickup_quartier, pickup_date, is_outside_dakar,
      relay_point_id, relay_point_name, relay_point_address,
      assigned_transporteur_ref, assigned_departure_id, gp_id,
      final_amount_xof, notes, admin_notes,
      reference, parent_dossier_id, split_index, split_count,
      skip_whatsapp_trigger
    ) VALUES (
      v_parent.user_id, v_parent.business_id, v_parent.dossier_type,
      COALESCE((v_part->>'status')::public.dossier_status, v_parent.status),
      v_parent.app_source, v_parent.source, v_parent.intake_method,
      v_parent.origin_country, v_parent.origin_city, v_parent.destination_country, v_parent.destination_city,
      COALESCE(NULLIF(v_part->>'description',''), v_parent.product_description),
      NULLIF(v_part->>'weight','')::numeric,
      NULLIF(v_part->>'weight','')::numeric,
      v_parent.quantity, v_parent.unit,
      v_parent.declared_value, v_parent.currency,
      COALESCE(NULLIF(v_part->>'transport_mode',''), v_parent.transport_mode),
      v_parent.delivery_mode,
      v_parent.sender_name, v_parent.sender_phone, v_parent.sender_address,
      v_parent.recipient_name, v_parent.recipient_phone, v_parent.recipient_address,
      v_parent.contact_phone, v_parent.contact_email,
      v_parent.pickup_zone, v_parent.pickup_quartier, v_parent.pickup_date, v_parent.is_outside_dakar,
      v_parent.relay_point_id, v_parent.relay_point_name, v_parent.relay_point_address,
      NULLIF(v_part->>'transporteur_ref',''),
      NULLIF(v_part->>'departure_id','')::uuid,
      NULLIF(v_part->>'gp_id','')::uuid,
      CASE
        WHEN v_total_weight > 0 AND v_parent.final_amount_xof IS NOT NULL
        THEN ROUND(v_parent.final_amount_xof * COALESCE(NULLIF(v_part->>'weight','')::numeric, 0) / v_total_weight)
        ELSE NULL
      END,
      NULLIF(v_part->>'notes',''), v_parent.admin_notes,
      v_parent.reference || '-' || v_i,
      v_parent.id, v_i, v_count,
      true
    )
    RETURNING id INTO v_new_id;
  END LOOP;

  UPDATE public.dossiers
     SET split_count = v_count,
         updated_at = now()
   WHERE id = v_parent.id;

  RETURN QUERY
    SELECT * FROM public.dossiers
     WHERE parent_dossier_id = v_parent.id
     ORDER BY split_index;
END;
$$;

REVOKE ALL ON FUNCTION public.split_dossier(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.split_dossier(uuid, jsonb) TO authenticated, service_role;