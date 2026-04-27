-- ============================================================================
-- 1. Drop legacy table (reset complet)
-- ============================================================================
DROP TABLE IF EXISTS public.routes_pricing CASCADE;

-- ============================================================================
-- 2. New pricing tables
-- ============================================================================
CREATE TABLE public.zones (
  zone_id      TEXT PRIMARY KEY,
  zone_name    TEXT NOT NULL,
  countries    TEXT[] NOT NULL DEFAULT '{}',
  modes        TEXT[] NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.zone_pricing (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id            TEXT NOT NULL REFERENCES public.zones(zone_id) ON DELETE CASCADE,
  mode               TEXT NOT NULL CHECK (mode IN ('air','sea_lcl','road')),
  base_price_xof     INTEGER NOT NULL CHECK (base_price_xof >= 0),
  price_per_unit     INTEGER NOT NULL CHECK (price_per_unit >= 0),
  min_taxable        INTEGER NOT NULL DEFAULT 1,
  currency           TEXT NOT NULL DEFAULT 'XOF',
  delivery_days_min  INTEGER NOT NULL DEFAULT 1,
  delivery_days_max  INTEGER NOT NULL DEFAULT 7,
  active             BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (zone_id, mode)
);

CREATE TABLE public.pricing_adjustments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type        TEXT NOT NULL CHECK (type IN ('weight_bracket','urgency','goods_type','supply')),
  key         TEXT NOT NULL,
  multiplier  NUMERIC(5,3) NOT NULL DEFAULT 1.0,
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, key)
);

CREATE INDEX idx_zone_pricing_lookup ON public.zone_pricing(zone_id, mode) WHERE active = true;
CREATE INDEX idx_pricing_adj_lookup  ON public.pricing_adjustments(type, key) WHERE active = true;

-- updated_at triggers
CREATE TRIGGER trg_zones_updated_at
  BEFORE UPDATE ON public.zones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_zone_pricing_updated_at
  BEFORE UPDATE ON public.zone_pricing
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_pricing_adj_updated_at
  BEFORE UPDATE ON public.pricing_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3. RLS
-- ============================================================================
ALTER TABLE public.zones               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.zone_pricing        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read zones"            ON public.zones               FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Public read zone pricing"     ON public.zone_pricing        FOR SELECT TO anon, authenticated USING (active = true OR is_staff(auth.uid()));
CREATE POLICY "Public read adjustments"      ON public.pricing_adjustments FOR SELECT TO anon, authenticated USING (active = true OR is_staff(auth.uid()));

CREATE POLICY "Staff manage zones"           ON public.zones               FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff manage zone pricing"    ON public.zone_pricing        FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));
CREATE POLICY "Staff manage adjustments"     ON public.pricing_adjustments FOR ALL TO authenticated USING (is_staff(auth.uid())) WITH CHECK (is_staff(auth.uid()));

-- ============================================================================
-- 4. Seed zones
-- ============================================================================
INSERT INTO public.zones (zone_id, zone_name, countries, modes) VALUES
  ('Z1', 'Afrique de l''Ouest (CEDEAO)',
    ARRAY['SN','ML','GN','GW','GM','MR','CI','TG','BJ','GH','NG','BF','NE','CV','SL','LR'],
    ARRAY['air','road']),
  ('Z2', 'Afrique centrale & de l''Est',
    ARRAY['CM','GA','CD','CG','KE','ET','TZ','MZ','AO'],
    ARRAY['air']),
  ('Z3', 'Afrique du Nord & Maghreb',
    ARRAY['MA','TN','DZ','EG','LY'],
    ARRAY['air']),
  ('Z4', 'Europe',
    ARRAY['FR','ES','PT','BE','DE','IT','NL','GB','CH'],
    ARRAY['air','sea_lcl']),
  ('Z5', 'Moyen-Orient & Asie',
    ARRAY['AE','TR','CN','IN','HK','SG'],
    ARRAY['air']),
  ('Z6', 'Amériques',
    ARRAY['US','CA','BR','MX'],
    ARRAY['air']);

-- ============================================================================
-- 5. Seed zone_pricing
-- ============================================================================
INSERT INTO public.zone_pricing (zone_id, mode, base_price_xof, price_per_unit, min_taxable, delivery_days_min, delivery_days_max) VALUES
  ('Z1','air',     15000, 3500, 3, 1, 2),
  ('Z1','road',     8000, 1500, 1, 2, 5),
  ('Z2','air',     22000, 5000, 3, 2, 4),
  ('Z3','air',     18000, 4200, 3, 1, 3),
  ('Z4','air',     25000, 6500, 3, 3, 5),
  ('Z4','sea_lcl', 35000, 8000, 1, 18, 25),
  ('Z5','air',     28000, 7800, 3, 4, 7),
  ('Z6','air',     32000, 9000, 3, 5, 8);

-- ============================================================================
-- 6. Seed pricing_adjustments
-- ============================================================================
INSERT INTO public.pricing_adjustments (type, key, multiplier) VALUES
  -- weight brackets
  ('weight_bracket','0-5',     1.00),
  ('weight_bracket','5-30',    0.92),
  ('weight_bracket','30-100',  0.85),
  ('weight_bracket','100-300', 0.78),
  ('weight_bracket','300+',    1.00),  -- flagged manual_quote in code
  -- urgency
  ('urgency','standard', 1.00),
  ('urgency','express',  1.35),
  ('urgency','same_day', 1.80),
  -- goods type
  ('goods_type','standard',   1.00),
  ('goods_type','fragile',    1.15),
  ('goods_type','food',       1.10),
  ('goods_type','hazardous',  1.50),
  ('goods_type','high_value', 1.20),
  -- supply
  ('supply','high',   0.93),
  ('supply','normal', 1.00),
  ('supply','low',    1.12),
  ('supply','none',   1.00);

-- ============================================================================
-- 7. New calculate_quote_v2 — XOF, zone-based
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resolve_zone_for_country(p_country TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT z.zone_id
    FROM public.zones z
   WHERE upper(p_country) = ANY (SELECT upper(c) FROM unnest(z.countries) c)
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.calculate_quote_v2(
  p_destination_country TEXT,
  p_real_weight_kg      NUMERIC,
  p_length_cm           NUMERIC DEFAULT NULL,
  p_width_cm            NUMERIC DEFAULT NULL,
  p_height_cm           NUMERIC DEFAULT NULL,
  p_transport_mode      TEXT DEFAULT 'air',
  p_priority            TEXT DEFAULT 'standard',
  p_goods_type          TEXT DEFAULT 'standard'
)
RETURNS TABLE (
  zone_id              TEXT,
  zone_name            TEXT,
  transport_mode       TEXT,
  taxable_weight_kg    NUMERIC,
  volumetric_weight_kg NUMERIC,
  base_price_xof       INTEGER,
  weight_cost_xof      NUMERIC,
  raw_price_xof        NUMERIC,
  weight_bracket_mult  NUMERIC,
  goods_mult           NUMERIC,
  urgency_mult         NUMERIC,
  supply_mult          NUMERIC,
  margin_mult          NUMERIC,
  price_xof            INTEGER,
  price_eur            NUMERIC,
  delivery_days_min    INTEGER,
  delivery_days_max    INTEGER,
  confidence           TEXT,
  requires_manual_quote BOOLEAN,
  insurance_required   BOOLEAN,
  fallback_mode        BOOLEAN
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_zone     TEXT;
  v_mode     TEXT := lower(coalesce(p_transport_mode,'air'));
  v_pricing  RECORD;
  v_real     NUMERIC := GREATEST(0, COALESCE(p_real_weight_kg, 0));
  v_vol      NUMERIC := 0;
  v_taxable  NUMERIC;
  v_div      NUMERIC;
  v_units    NUMERIC; -- kg or m³ depending on mode
  v_raw      NUMERIC;
  v_bracket  TEXT;
  v_w_mult   NUMERIC := 1.0;
  v_g_mult   NUMERIC := 1.0;
  v_u_mult   NUMERIC := 1.0;
  v_s_mult   NUMERIC := 1.0;
  v_margin   CONSTANT NUMERIC := 1.22;
  v_xof_per_eur CONSTANT NUMERIC := 655.957;
  v_conf     TEXT := 'high';
  v_manual   BOOLEAN := false;
  v_insure   BOOLEAN := false;
  v_fallback BOOLEAN := false;
BEGIN
  -- Resolve zone
  v_zone := resolve_zone_for_country(p_destination_country);
  IF v_zone IS NULL THEN
    v_zone := 'Z4';      -- fallback: Europe
    v_conf := 'low';
    v_fallback := true;
  END IF;

  SELECT zp.* INTO v_pricing
    FROM public.zone_pricing zp
   WHERE zp.zone_id = v_zone AND zp.mode = v_mode AND zp.active = true
   LIMIT 1;

  IF v_pricing IS NULL THEN
    -- Try any available mode in this zone
    SELECT zp.* INTO v_pricing
      FROM public.zone_pricing zp
     WHERE zp.zone_id = v_zone AND zp.active = true
     ORDER BY zp.base_price_xof ASC
     LIMIT 1;
    v_conf := 'medium';
  END IF;

  IF v_pricing IS NULL THEN
    -- Hard fallback values
    v_pricing := ROW(NULL,'','air',25000,6500,3,'XOF',3,7,true,now(),now())::public.zone_pricing;
    v_conf := 'low';
    v_fallback := true;
  END IF;

  -- Volumetric weight
  IF p_length_cm IS NOT NULL AND p_width_cm IS NOT NULL AND p_height_cm IS NOT NULL THEN
    v_div := CASE v_pricing.mode
      WHEN 'air'     THEN 6000
      WHEN 'sea_lcl' THEN 1000
      WHEN 'road'    THEN 4000
      ELSE 6000
    END;
    v_vol := (p_length_cm * p_width_cm * p_height_cm) / v_div;
  END IF;

  v_taxable := GREATEST(v_real, v_vol);
  v_taxable := GREATEST(v_taxable, v_pricing.min_taxable);

  -- Pricing units: CBM for sea_lcl, kg otherwise
  IF v_pricing.mode = 'sea_lcl' THEN
    IF p_length_cm IS NOT NULL AND p_width_cm IS NOT NULL AND p_height_cm IS NOT NULL THEN
      v_units := (p_length_cm * p_width_cm * p_height_cm) / 1000000.0;
    ELSE
      v_units := GREATEST(v_taxable / 333.0, 0.1); -- approx kg→m³
    END IF;
    v_raw := v_pricing.base_price_xof + (v_units * v_pricing.price_per_unit);
  ELSE
    v_raw := v_pricing.base_price_xof + (GREATEST(0, v_taxable - 1) * v_pricing.price_per_unit);
  END IF;

  -- Manual quote flag
  IF v_taxable > 300 THEN v_manual := true; END IF;

  -- Bracket
  v_bracket := CASE
    WHEN v_taxable <= 5   THEN '0-5'
    WHEN v_taxable <= 30  THEN '5-30'
    WHEN v_taxable <= 100 THEN '30-100'
    WHEN v_taxable <= 300 THEN '100-300'
    ELSE '300+'
  END;
  SELECT multiplier INTO v_w_mult FROM public.pricing_adjustments
   WHERE type='weight_bracket' AND key=v_bracket AND active=true LIMIT 1;
  v_w_mult := COALESCE(v_w_mult, 1.0);

  SELECT multiplier INTO v_g_mult FROM public.pricing_adjustments
   WHERE type='goods_type' AND key=lower(coalesce(p_goods_type,'standard')) AND active=true LIMIT 1;
  v_g_mult := COALESCE(v_g_mult, 1.0);
  IF lower(coalesce(p_goods_type,'')) = 'high_value' THEN v_insure := true; END IF;

  SELECT multiplier INTO v_u_mult FROM public.pricing_adjustments
   WHERE type='urgency' AND key=lower(coalesce(p_priority,'standard')) AND active=true LIMIT 1;
  v_u_mult := COALESCE(v_u_mult, 1.0);

  -- Supply lookup from konnekt_departures (next 30 days, matching zone destinations)
  DECLARE
    avail NUMERIC := 0;
    total NUMERIC := 0;
    ratio NUMERIC := 0;
    sup_key TEXT := 'none';
  BEGIN
    SELECT COALESCE(SUM(kd.available_capacity_kg),0), COALESCE(SUM(kd.total_capacity_kg),0)
      INTO avail, total
      FROM public.konnekt_departures kd
     WHERE kd.status = 'OPEN'
       AND kd.departure_date BETWEEN current_date AND current_date + INTERVAL '30 days'
       AND lower(kd.transport) = v_pricing.mode
       AND upper(kd.destination_country) = upper(p_destination_country);
    IF total > 0 THEN
      ratio := avail / total;
      sup_key := CASE
        WHEN ratio > 0.7  THEN 'high'
        WHEN ratio < 0.3  THEN 'low'
        ELSE 'normal'
      END;
    ELSE
      sup_key := 'none';
      v_fallback := true;
    END IF;
    SELECT multiplier INTO v_s_mult FROM public.pricing_adjustments
     WHERE type='supply' AND key=sup_key AND active=true LIMIT 1;
    v_s_mult := COALESCE(v_s_mult, 1.0);
  END;

  -- Compose
  DECLARE
    final_xof NUMERIC := v_raw * v_w_mult * v_g_mult * v_u_mult * v_s_mult * v_margin;
  BEGIN
    zone_id              := v_zone;
    SELECT zone_name INTO zone_name FROM public.zones WHERE zones.zone_id = v_zone;
    transport_mode       := v_pricing.mode;
    taxable_weight_kg    := round(v_taxable::numeric, 2);
    volumetric_weight_kg := round(v_vol::numeric, 2);
    base_price_xof       := v_pricing.base_price_xof;
    weight_cost_xof      := round((v_raw - v_pricing.base_price_xof)::numeric, 0);
    raw_price_xof        := round(v_raw::numeric, 0);
    weight_bracket_mult  := v_w_mult;
    goods_mult           := v_g_mult;
    urgency_mult         := v_u_mult;
    supply_mult          := v_s_mult;
    margin_mult          := v_margin;
    price_xof            := round(final_xof / 100.0)::int * 100; -- round to nearest 100 XOF
    price_eur            := round((final_xof / v_xof_per_eur)::numeric, 0);
    delivery_days_min    := v_pricing.delivery_days_min;
    delivery_days_max    := v_pricing.delivery_days_max;
    confidence           := v_conf;
    requires_manual_quote := v_manual;
    insurance_required   := v_insure;
    fallback_mode        := v_fallback;
    RETURN NEXT;
  END;
END;
$$;

-- ============================================================================
-- 8. Replace legacy calculate_quote with shim that delegates to v2
--    (keeps auto_match_shipment working without changes)
-- ============================================================================
DROP FUNCTION IF EXISTS public.calculate_quote(text, text, numeric, text, text, text, text);

CREATE OR REPLACE FUNCTION public.calculate_quote(
  p_origin_country      TEXT,
  p_destination_country TEXT,
  p_weight_kg           NUMERIC,
  p_transport_type      TEXT DEFAULT NULL,
  p_priority            TEXT DEFAULT 'normal',
  p_origin_city         TEXT DEFAULT NULL,
  p_destination_city    TEXT DEFAULT NULL
)
RETURNS TABLE (
  price_eur             NUMERIC,
  currency              TEXT,
  eta_min_days          INTEGER,
  eta_max_days          INTEGER,
  transport_type        TEXT,
  confidence            TEXT,
  base_price_eur        NUMERIC,
  weight_cost_eur       NUMERIC,
  urgency_multiplier    NUMERIC,
  supply_adjustment_eur NUMERIC,
  margin_multiplier     NUMERIC
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v RECORD;
  v_mode TEXT;
  v_priority TEXT;
BEGIN
  -- Map legacy values to v2 vocabulary
  v_mode := CASE lower(coalesce(p_transport_type,'air'))
    WHEN 'sea' THEN 'sea_lcl'
    WHEN 'air' THEN 'air'
    WHEN 'road' THEN 'road'
    ELSE 'air'
  END;
  v_priority := CASE lower(coalesce(p_priority,'normal'))
    WHEN 'urgent' THEN 'express'
    WHEN 'normal' THEN 'standard'
    ELSE lower(coalesce(p_priority,'standard'))
  END;

  SELECT * INTO v FROM public.calculate_quote_v2(
    p_destination_country, p_weight_kg, NULL, NULL, NULL,
    v_mode, v_priority, 'standard'
  );

  price_eur             := v.price_eur;
  currency              := 'EUR';
  eta_min_days          := v.delivery_days_min;
  eta_max_days          := v.delivery_days_max;
  transport_type        := upper(v.transport_mode);
  confidence            := v.confidence;
  base_price_eur        := round((v.base_price_xof / 655.957)::numeric, 2);
  weight_cost_eur       := round((v.weight_cost_xof / 655.957)::numeric, 2);
  urgency_multiplier    := v.urgency_mult;
  supply_adjustment_eur := round(((v.supply_mult - 1) * v.raw_price_xof / 655.957)::numeric, 2);
  margin_multiplier     := v.margin_mult;
  RETURN NEXT;
END;
$$;