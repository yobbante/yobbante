DROP FUNCTION IF EXISTS public.calculate_quote_v2(text, numeric, numeric, numeric, numeric, text, text, text);

CREATE OR REPLACE FUNCTION public.calculate_quote_v2(
  p_destination_country text,
  p_real_weight_kg numeric,
  p_length_cm numeric DEFAULT NULL,
  p_width_cm numeric DEFAULT NULL,
  p_height_cm numeric DEFAULT NULL,
  p_transport_mode text DEFAULT 'air',
  p_priority text DEFAULT 'standard',
  p_goods_type text DEFAULT 'standard'
)
RETURNS TABLE(
  zone_id text,
  zone_name text,
  transport_mode text,
  taxable_weight_kg numeric,
  volumetric_weight_kg numeric,
  base_price_xof numeric,
  weight_cost_xof numeric,
  raw_price_xof numeric,
  weight_bracket_mult numeric,
  goods_mult numeric,
  urgency_mult numeric,
  supply_mult numeric,
  margin_mult numeric,
  price_xof numeric,
  price_eur numeric,
  delivery_days_min int,
  delivery_days_max int,
  fallback_mode boolean,
  requires_manual_quote boolean,
  insurance_required boolean,
  confidence text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_zone text;
  v_zone_name text;
  v_pricing record;
  v_vol numeric := 0;
  v_taxable numeric;
  v_raw numeric;
  v_w_mult numeric := 1.0;
  v_g_mult numeric := 1.0;
  v_u_mult numeric := 1.0;
  v_s_mult numeric := 1.0;
  v_margin numeric := 1.22;
  v_fallback boolean := false;
  v_manual boolean := false;
  v_insurance boolean := false;
  v_conf text := 'high';
  sup_key text;
  v_supply_total numeric;
  v_supply_avail numeric;
BEGIN
  v_zone := public.resolve_zone_for_country(p_destination_country);
  IF v_zone IS NULL THEN
    v_zone := 'Z1';
    v_conf := 'low';
    v_fallback := true;
  END IF;

  SELECT * INTO v_pricing FROM public.zone_pricing zp
   WHERE zp.zone_id = v_zone AND zp.mode = p_transport_mode AND zp.active = true LIMIT 1;

  IF NOT FOUND THEN
    SELECT * INTO v_pricing FROM public.zone_pricing zp
     WHERE zp.zone_id = v_zone AND zp.active = true
     ORDER BY zp.base_price_xof ASC LIMIT 1;
    v_fallback := true;
    v_conf := 'medium';
  END IF;

  IF NOT FOUND THEN
    SELECT z.zone_name INTO v_zone_name FROM public.zones z WHERE z.zone_id = v_zone;
    zone_id := v_zone; zone_name := COALESCE(v_zone_name, 'Inconnue');
    transport_mode := p_transport_mode;
    taxable_weight_kg := p_real_weight_kg; volumetric_weight_kg := 0;
    base_price_xof := 0; weight_cost_xof := 0; raw_price_xof := 0;
    weight_bracket_mult := 1; goods_mult := 1; urgency_mult := 1; supply_mult := 1; margin_mult := v_margin;
    price_xof := 0; price_eur := 0;
    delivery_days_min := 1; delivery_days_max := 14;
    fallback_mode := true; requires_manual_quote := true;
    insurance_required := false; confidence := 'low';
    RETURN NEXT; RETURN;
  END IF;

  IF p_length_cm IS NOT NULL AND p_width_cm IS NOT NULL AND p_height_cm IS NOT NULL THEN
    v_vol := CASE v_pricing.mode
               WHEN 'air'     THEN (p_length_cm * p_width_cm * p_height_cm) / 6000.0
               WHEN 'sea_lcl' THEN (p_length_cm * p_width_cm * p_height_cm) / 1000.0
               WHEN 'road'    THEN (p_length_cm * p_width_cm * p_height_cm) / 4000.0
               ELSE 0
             END;
  END IF;

  v_taxable := GREATEST(p_real_weight_kg, v_vol, v_pricing.min_taxable);
  IF v_taxable > 300 THEN v_manual := true; END IF;

  v_raw := v_pricing.base_price_xof + (GREATEST(0, v_taxable - 1) * v_pricing.price_per_unit);

  SELECT pa.multiplier INTO v_w_mult FROM public.pricing_adjustments pa
   WHERE pa.type = 'weight_bracket' AND pa.active = true
     AND CASE WHEN v_taxable <= 5 THEN pa.key = '0-5'
              WHEN v_taxable <= 30 THEN pa.key = '5-30'
              WHEN v_taxable <= 100 THEN pa.key = '30-100'
              WHEN v_taxable <= 300 THEN pa.key = '100-300'
              ELSE pa.key = '300+' END
   LIMIT 1;
  v_w_mult := COALESCE(v_w_mult, 1.0);

  SELECT pa.multiplier INTO v_g_mult FROM public.pricing_adjustments pa
   WHERE pa.type = 'goods_type' AND pa.key = p_goods_type AND pa.active = true LIMIT 1;
  v_g_mult := COALESCE(v_g_mult, 1.0);
  IF p_goods_type = 'high_value' THEN v_insurance := true; END IF;

  SELECT pa.multiplier INTO v_u_mult FROM public.pricing_adjustments pa
   WHERE pa.type = 'urgency' AND pa.key = p_priority AND pa.active = true LIMIT 1;
  v_u_mult := COALESCE(v_u_mult, 1.0);

  DECLARE v_ratio numeric;
  BEGIN
    SELECT kd.total_capacity_kg, kd.available_capacity_kg
      INTO v_supply_total, v_supply_avail FROM public.konnekt_departures kd
     WHERE kd.status = 'OPEN' AND kd.departure_date >= CURRENT_DATE AND kd.total_capacity_kg > 0
     ORDER BY kd.departure_date ASC LIMIT 1;
    IF v_supply_total IS NOT NULL AND v_supply_total > 0 THEN
      v_ratio := v_supply_avail / v_supply_total;
      sup_key := CASE WHEN v_ratio > 0.7 THEN 'high' WHEN v_ratio < 0.3 THEN 'low' ELSE 'normal' END;
    ELSE sup_key := 'none'; END IF;
    SELECT pa.multiplier INTO v_s_mult FROM public.pricing_adjustments pa
     WHERE pa.type = 'supply' AND pa.key = sup_key AND pa.active = true LIMIT 1;
    v_s_mult := COALESCE(v_s_mult, 1.0);
  END;

  DECLARE final_xof numeric := v_raw * v_w_mult * v_g_mult * v_u_mult * v_s_mult * v_margin;
  BEGIN
    SELECT z.zone_name INTO v_zone_name FROM public.zones z WHERE z.zone_id = v_zone;
    zone_id := v_zone; zone_name := COALESCE(v_zone_name, 'Inconnue');
    transport_mode := v_pricing.mode;
    taxable_weight_kg := round(v_taxable::numeric, 2);
    volumetric_weight_kg := round(v_vol::numeric, 2);
    base_price_xof := v_pricing.base_price_xof;
    weight_cost_xof := round(GREATEST(0, v_taxable - 1) * v_pricing.price_per_unit, 0);
    raw_price_xof := round(v_raw, 0);
    weight_bracket_mult := v_w_mult;
    goods_mult := v_g_mult;
    urgency_mult := v_u_mult;
    supply_mult := v_s_mult;
    margin_mult := v_margin;
    price_xof := round(final_xof, 0);
    price_eur := round(final_xof / 655.957, 2);
    delivery_days_min := v_pricing.delivery_days_min;
    delivery_days_max := v_pricing.delivery_days_max;
    fallback_mode := v_fallback;
    requires_manual_quote := v_manual;
    insurance_required := v_insurance;
    confidence := v_conf;
    RETURN NEXT;
  END;
END;
$$;