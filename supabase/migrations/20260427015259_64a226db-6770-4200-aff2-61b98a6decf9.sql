
CREATE OR REPLACE FUNCTION public.calculate_quote(
  p_origin_country text,
  p_destination_country text,
  p_weight_kg numeric,
  p_transport_type text DEFAULT NULL,
  p_priority text DEFAULT 'normal',
  p_origin_city text DEFAULT NULL,
  p_destination_city text DEFAULT NULL
) RETURNS TABLE(
  price_eur numeric,
  currency text,
  eta_min_days int,
  eta_max_days int,
  transport_type text,
  confidence text,
  base_price_eur numeric,
  weight_cost_eur numeric,
  urgency_multiplier numeric,
  supply_adjustment_eur numeric,
  margin_multiplier numeric
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  r record;
  weight numeric := GREATEST(0.5, COALESCE(p_weight_kg, 1));
  base numeric;
  per_kg numeric;
  weight_cost numeric;
  mult numeric;
  supply_adj numeric := 0;
  open_caps numeric;
  raw_price numeric;
  final numeric;
  margin CONSTANT numeric := 1.20;
  conf text;
BEGIN
  SELECT rp.*
    INTO r
    FROM public.routes_pricing rp
   WHERE rp.active = true
     AND upper(rp.origin_country) = upper(p_origin_country)
     AND upper(rp.destination_country) = upper(p_destination_country)
     AND (p_transport_type IS NULL OR rp.transport_type = upper(p_transport_type))
   ORDER BY (CASE WHEN p_transport_type IS NOT NULL AND rp.transport_type = upper(p_transport_type) THEN 0 ELSE 1 END),
            rp.base_price_eur ASC
   LIMIT 1;

  IF r IS NULL THEN
    base := 30;
    per_kg := 8;
    transport_type := COALESCE(upper(p_transport_type), 'AIR');
    eta_min_days := 7;
    eta_max_days := 21;
    conf := 'low';
  ELSE
    base := r.base_price_eur;
    per_kg := r.price_per_kg_eur;
    transport_type := r.transport_type;
    eta_min_days := r.eta_min_days;
    eta_max_days := r.eta_max_days;
    conf := 'high';
  END IF;

  weight_cost := weight * per_kg;
  mult := CASE WHEN lower(COALESCE(p_priority,'normal')) = 'urgent' THEN 1.3 ELSE 1.0 END;

  SELECT COALESCE(SUM(kd.available_capacity_kg), 0)
    INTO open_caps
    FROM public.konnekt_departures kd
   WHERE kd.status = 'OPEN'
     AND kd.departure_date >= current_date
     AND kd.departure_date <= current_date + interval '30 days'
     AND upper(kd.origin_country) = upper(p_origin_country)
     AND upper(kd.destination_country) = upper(p_destination_country);

  raw_price := (base + weight_cost) * mult;

  IF open_caps >= weight * 50 THEN
    supply_adj := -0.10 * raw_price;
  ELSIF open_caps < weight * 2 THEN
    supply_adj := 0.15 * raw_price;
    IF conf = 'high' THEN conf := 'medium'; END IF;
  END IF;

  final := (raw_price + supply_adj) * margin;

  price_eur := round(final::numeric, 2);
  currency := 'EUR';
  base_price_eur := base;
  weight_cost_eur := round(weight_cost::numeric, 2);
  urgency_multiplier := mult;
  supply_adjustment_eur := round(supply_adj::numeric, 2);
  margin_multiplier := margin;
  confidence := conf;

  RETURN NEXT;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.calculate_quote(text,text,numeric,text,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.calculate_quote(text,text,numeric,text,text,text,text) TO authenticated;
