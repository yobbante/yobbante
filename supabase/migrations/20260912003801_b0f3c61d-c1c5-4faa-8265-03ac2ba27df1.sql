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
    p_payload->>'notes', 'partner', 'partner', 'draft', 'ready'
  ) RETURNING id INTO v_dep_id;

  RETURN jsonb_build_object('ok', true, 'id', v_dep_id);
END;
$$;